import dns, { promises as dnsPromises } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';

/**
 * Récupération d'une ressource distante fournie par un utilisateur (ex. URL iCal Airbnb/Booking)
 * sans exposer le réseau interne (SSRF) : https uniquement, port par défaut, adresses IP publiques
 * vérifiées à la résolution DNS **et** à l'ouverture de la connexion (anti DNS rebinding),
 * redirections revalidées à chaque saut, taille de réponse plafonnée.
 */

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Plages non routables sur Internet : privé, loopback, lien local, CGNAT, multicast, réservé…
const BLOCKED_IPV4 = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED_IPV4.addSubnet(address, prefix, 'ipv4');
}

// IPv6 : seul l'unicast global (2000::/3) est accepté, moins les plages qui embarquent une IPv4
// arbitraire (Teredo, 6to4) ou réservées à la documentation.
const GLOBAL_UNICAST_IPV6 = new net.BlockList();
GLOBAL_UNICAST_IPV6.addSubnet('2000::', 3, 'ipv6');

const BLOCKED_IPV6 = new net.BlockList();
for (const [address, prefix] of [
  ['2001::', 32],
  ['2001:2::', 48],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const) {
  BLOCKED_IPV6.addSubnet(address, prefix, 'ipv6');
}

export class UnsafeRemoteUrlError extends Error {
  readonly statusCode = 400;
}

export class RemoteFetchError extends Error {
  readonly statusCode = 400;
}

function expandIpv6(address: string): number[] | null {
  let value = address.split('%')[0]?.toLowerCase() ?? '';

  const embeddedIpv4 = value.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (embeddedIpv4) {
    const [a, b, c, d] = embeddedIpv4.slice(1).map(Number) as [number, number, number, number];
    value = `${value.slice(0, -embeddedIpv4[0].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
    .map((group) => Number.parseInt(group, 16));

  if (groups.length !== 8 || groups.some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)) return null;
  return groups;
}

/** `::ffff:a.b.c.d` (IPv4 mappée) → `a.b.c.d`, pour lui appliquer les règles IPv4. */
function readMappedIpv4(address: string): string | null {
  const groups = expandIpv6(address);
  if (!groups) return null;
  if (groups.slice(0, 5).some((group) => group !== 0) || groups[5] !== 0xffff) return null;

  const high = groups[6] ?? 0;
  const low = groups[7] ?? 0;
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

export function isPublicIpAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !BLOCKED_IPV4.check(address, 'ipv4');
  if (family !== 6) return false;

  const mapped = readMappedIpv4(address);
  if (mapped) return isPublicIpAddress(mapped);
  if (address.includes('%')) return false;

  return GLOBAL_UNICAST_IPV6.check(address, 'ipv6') && !BLOCKED_IPV6.check(address, 'ipv6');
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

/**
 * Contrôles statiques : schéma (webcal:// et http:// sont réécrits en https://), identifiants,
 * port, nom d'hôte. Ne résout pas le DNS.
 */
export function normalizePublicHttpsUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim().replace(/^(webcals?|https?):\/\//i, 'https://');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new UnsafeRemoteUrlError('URL invalide.');
  }

  if (url.protocol !== 'https:') {
    throw new UnsafeRemoteUrlError('Seules les adresses https:// (ou webcal://) sont acceptées.');
  }

  if (url.username || url.password) {
    throw new UnsafeRemoteUrlError('Les identifiants dans l’URL ne sont pas acceptés.');
  }

  // `URL` vide le port quand c'est celui par défaut (443).
  if (url.port) {
    throw new UnsafeRemoteUrlError('Le port de cette URL n’est pas autorisé.');
  }

  const hostname = stripIpv6Brackets(url.hostname).toLowerCase();
  if (!hostname) {
    throw new UnsafeRemoteUrlError('URL invalide.');
  }

  if (net.isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new UnsafeRemoteUrlError('Cette adresse pointe vers un réseau privé et ne peut pas être utilisée.');
    }
    return url;
  }

  // Noms internes (conteneurs Docker, localhost, mDNS) : jamais une source publique.
  if (!hostname.includes('.') || hostname === 'localhost' || /\.(localhost|local|internal|home\.arpa)$/.test(hostname)) {
    throw new UnsafeRemoteUrlError('Cette adresse pointe vers un réseau privé et ne peut pas être utilisée.');
  }

  return url;
}

/** Contrôles statiques + résolution DNS : toutes les adresses doivent être publiques. */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  const url = normalizePublicHttpsUrl(rawUrl);
  const hostname = stripIpv6Brackets(url.hostname);
  if (net.isIP(hostname)) return url;

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dnsPromises.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeRemoteUrlError(`Impossible de résoudre le domaine ${hostname}.`);
  }

  if (!addresses.length || addresses.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new UnsafeRemoteUrlError('Cette adresse pointe vers un réseau privé et ne peut pas être utilisée.');
  }

  return url;
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/** Résolution faite par la socket elle-même : revalide l'IP réellement contactée. */
function publicOnlyLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, '');
      return;
    }

    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((entry) => !isPublicIpAddress(entry.address))) {
      callback(new UnsafeRemoteUrlError('Cette adresse pointe vers un réseau privé et ne peut pas être utilisée.'), '');
      return;
    }

    if (options.all) {
      callback(null, list);
      return;
    }

    const first = list[0] as dns.LookupAddress;
    callback(null, first.address, first.family);
  });
}

function decodeBody(response: IncomingMessage): Readable {
  const encoding = String(response.headers['content-encoding'] ?? '').trim().toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return response.pipe(zlib.createGunzip());
  if (encoding === 'deflate') return response.pipe(zlib.createInflate());
  if (encoding === 'br') return response.pipe(zlib.createBrotliDecompress());
  return response;
}

function readLimitedBody(response: IncomingMessage, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    response.destroy();
    return Promise.reject(new RemoteFetchError(`La ressource distante dépasse la taille maximale autorisée (${Math.round(maxBytes / (1024 * 1024))} Mo).`));
  }

  return new Promise((resolve, reject) => {
    const stream = decodeBody(response);
    const chunks: Buffer[] = [];
    let total = 0;

    stream.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        response.destroy();
        stream.destroy();
        reject(new RemoteFetchError(`La ressource distante dépasse la taille maximale autorisée (${Math.round(maxBytes / (1024 * 1024))} Mo).`));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
    response.on('error', reject);
    response.on('aborted', () => reject(new RemoteFetchError('La connexion à la ressource distante a été interrompue.')));
  });
}

type SingleResponse =
  | { kind: 'redirect'; location: string }
  | { kind: 'body'; status: number; body: string };

function requestOnce(url: URL, options: { accept: string; maxBytes: number; signal: AbortSignal }): Promise<SingleResponse> {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      agent: false,
      lookup: publicOnlyLookup,
      signal: options.signal,
      headers: {
        Accept: options.accept,
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'IndieHost-Calendar-Sync/1.0 (+https://indiehost.fr)',
      },
    }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;

      if (REDIRECT_STATUSES.has(status) && typeof location === 'string' && location.trim()) {
        response.resume();
        resolve({ kind: 'redirect', location: location.trim() });
        return;
      }

      if (status < 200 || status >= 300) {
        response.resume();
        resolve({ kind: 'body', status, body: '' });
        return;
      }

      readLimitedBody(response, options.maxBytes)
        .then((body) => resolve({ kind: 'body', status, body }))
        .catch(reject);
    });

    request.on('error', reject);
    request.end();
  });
}

export type FetchPublicTextOptions = {
  /** Délai global, redirections comprises. */
  timeoutMs: number;
  maxBytes: number;
  maxRedirects?: number;
  accept?: string;
};

/**
 * GET d'une URL publique https, en texte. Les statuts hors 2xx sont renvoyés tels quels
 * (corps vide) ; les erreurs réseau, de taille ou de validation sont levées.
 * Un dépassement du délai lève une erreur `AbortError`.
 */
export async function fetchPublicText(rawUrl: string, options: FetchPublicTextOptions): Promise<{ status: number; body: string; url: string }> {
  const maxRedirects = options.maxRedirects ?? 3;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), options.timeoutMs);

  try {
    let url = await assertPublicHttpsUrl(rawUrl);

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const response = await requestOnce(url, {
        accept: options.accept ?? '*/*',
        maxBytes: options.maxBytes,
        signal: abortController.signal,
      });

      if (response.kind === 'body') {
        return { status: response.status, body: response.body, url: url.toString() };
      }

      let next: URL;
      try {
        next = new URL(response.location, url);
      } catch {
        throw new RemoteFetchError('Redirection invalide renvoyée par la ressource distante.');
      }
      url = await assertPublicHttpsUrl(next.toString());
    }

    throw new RemoteFetchError('Trop de redirections vers la ressource distante.');
  } finally {
    clearTimeout(timeout);
  }
}
