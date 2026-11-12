// Google Search Console, sans rien demander à l'hôte : le compte de service d'IndieHost valide chaque
// site par un fichier (`/google….html`, servi par l'API), l'ajoute à la Search Console, y envoie le
// sitemap et donne l'accès aux comptes d'IndieHost (`SEARCH_CONSOLE_OWNER_EMAILS`).
//
// Clé du compte de service : `GOOGLE_SERVICE_ACCOUNT_KEY` (fichier JSON de Google, tel quel ou en
// base64), ou `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`. Sans clé, rien n'est tenté.
//
// API utilisées : Site Verification v1 et Search Console (webmasters v3). L'API Indexing de Google
// est réservée aux offres d'emploi et aux vidéos en direct : elle n'est pas utilisée.

import { importPKCS8, SignJWT } from 'jose';

import { env } from '../../config/env.js';

const SCOPES = [
  'https://www.googleapis.com/auth/siteverification',
  'https://www.googleapis.com/auth/webmasters',
].join(' ');
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const VERIFICATION_API = 'https://www.googleapis.com/siteVerification/v1';
const SEARCH_CONSOLE_API = 'https://www.googleapis.com/webmasters/v3';
const REQUEST_TIMEOUT_MS = 20_000;

type ServiceAccount = { clientEmail: string; privateKey: string; tokenUri: string };

let accessToken: { value: string; expiresAt: number } | null = null;

function parseServiceAccount(raw: string): ServiceAccount | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const json = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf-8');
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    const clientEmail = typeof data.client_email === 'string' ? data.client_email : '';
    const privateKey = typeof data.private_key === 'string' ? data.private_key : '';
    if (!clientEmail || !privateKey) return null;
    const tokenUri = typeof data.token_uri === 'string' && data.token_uri ? data.token_uri : DEFAULT_TOKEN_URI;
    return { clientEmail, privateKey, tokenUri };
  } catch {
    return null;
  }
}

let serviceAccount: ServiceAccount | null | undefined;

function readServiceAccount(): ServiceAccount | null {
  if (serviceAccount === undefined) serviceAccount = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  return serviceAccount;
}

/** Inscription automatique dans la Search Console : clé fournie, et en production seulement. */
export function isSearchConsoleEnabled(): boolean {
  return env.NODE_ENV === 'production' && Boolean(readServiceAccount());
}

export function searchConsoleAccountEmail(): string | null {
  return readServiceAccount()?.clientEmail ?? null;
}

/** Comptes Google d'IndieHost qui voient les sites dans leur Search Console. */
export function searchConsoleOwnerEmails(): string[] {
  return env.SEARCH_CONSOLE_OWNER_EMAILS
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < accessToken.expiresAt - 60_000) return accessToken.value;
  const account = readServiceAccount();
  if (!account) throw new Error('Clé du compte de service Google absente.');

  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(account.privateKey, 'RS256');
  const assertion = await new SignJWT({ scope: SCOPES })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.clientEmail)
    .setAudience(account.tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch(account.tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await response.json().catch(() => ({})) as { access_token?: unknown; expires_in?: unknown; error_description?: unknown };
  if (!response.ok || typeof data.access_token !== 'string') {
    throw new Error(`Jeton Google refusé (${response.status}) : ${typeof data.error_description === 'string' ? data.error_description : 'réponse inattendue'}`);
  }
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  accessToken = { value: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return accessToken.value;
}

async function googleRequest<T>(method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: unknown } };
      if (typeof parsed.error?.message === 'string') message = parsed.error.message;
    } catch {
      // Réponse non JSON : on garde le début du texte.
    }
    throw new Error(`Google ${response.status} (${method} ${new URL(url).pathname}) : ${message}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Nom du fichier de validation à servir à la racine du site (`google1234abcd.html`). */
export async function requestVerificationFile(siteUrl: string): Promise<string> {
  const data = await googleRequest<{ token?: unknown }>('POST', `${VERIFICATION_API}/token`, {
    site: { type: 'SITE', identifier: siteUrl },
    verificationMethod: 'FILE',
  });
  const token = typeof data.token === 'string' ? data.token.trim() : '';
  if (!/^google[0-9a-f]{8,64}\.html$/.test(token)) throw new Error(`Fichier de validation inattendu : ${token || 'vide'}`);
  return token;
}

type WebResource = { id?: string; site?: { type?: string; identifier?: string }; owners?: string[] };

/** Google lit le fichier sur le site : le compte de service devient propriétaire validé. */
export async function verifySite(siteUrl: string): Promise<WebResource> {
  return googleRequest<WebResource>('POST', `${VERIFICATION_API}/webResource?verificationMethod=FILE`, {
    site: { type: 'SITE', identifier: siteUrl },
  });
}

/** Ajoute les comptes d'IndieHost aux propriétaires du site (ils le voient dans leur Search Console). */
export async function addOwners(resource: WebResource, siteUrl: string, emails: string[]): Promise<void> {
  if (!emails.length) return;
  const id = resource.id ?? encodeURIComponent(siteUrl);
  const current = await googleRequest<WebResource>('GET', `${VERIFICATION_API}/webResource/${encodeURIComponent(decodeURIComponent(id))}`);
  const owners = [...new Set([...(current.owners ?? []), ...emails])];
  if (owners.length === (current.owners ?? []).length) return;
  await googleRequest('PUT', `${VERIFICATION_API}/webResource/${encodeURIComponent(decodeURIComponent(id))}`, {
    site: { type: 'SITE', identifier: siteUrl },
    owners,
  });
}

export async function addSiteToSearchConsole(siteUrl: string): Promise<void> {
  await googleRequest('PUT', `${SEARCH_CONSOLE_API}/sites/${encodeURIComponent(siteUrl)}`);
}

export async function submitSitemap(siteUrl: string, sitemapUrl: string): Promise<void> {
  await googleRequest('PUT', `${SEARCH_CONSOLE_API}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`);
}
