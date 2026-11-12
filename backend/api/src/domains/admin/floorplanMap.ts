// Carte du code d'IndieHost dessinée par floorplan (plugin Claude Code, github.com/haydenschmitty/floorplan).
//
// La carte est un seul fichier HTML, exporté sans barre de questions ni chemin de la machine
// (`node floorplan/serve.mjs --export …`, voir CLAUDE.md) puis rangé dans assets/floorplan/. Elle
// décrit chaque partie du code et chaque route de l'API : elle n'est servie qu'à l'administration.
//
// Un cadre (iframe) ne peut pas envoyer l'en-tête Authorization : la page d'administration demande
// d'abord un ticket signé, valable deux minutes, puis charge la carte avec ce ticket. La carte tourne
// dans un bac à sable (en-tête CSP `sandbox`) : elle n'a accès ni aux cookies ni à la session du site.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MAP_FILE = path.resolve(process.cwd(), 'assets/floorplan/indiehost-map.html');
const TICKET_TTL_MS = 2 * 60 * 1000;
// Clé propre au processus : un ticket ne survit pas à un redémarrage, ce qui suffit pour deux minutes.
const TICKET_KEY = randomBytes(32);

export const FLOORPLAN_VIEW_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "sandbox allow-scripts allow-popups allow-downloads; frame-ancestors 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'",
};

export type FloorplanMapInfo = {
  available: boolean;
  updatedAtISO: string | null;
  sizeBytes: number | null;
};

let cached: { mtimeMs: number; html: string } | null = null;

export async function readFloorplanMapInfo(): Promise<FloorplanMapInfo> {
  try {
    const info = await stat(MAP_FILE);
    return { available: info.isFile(), updatedAtISO: info.mtime.toISOString(), sizeBytes: info.size };
  } catch {
    return { available: false, updatedAtISO: null, sizeBytes: null };
  }
}

export async function readFloorplanMapHtml(): Promise<string | null> {
  try {
    const info = await stat(MAP_FILE);
    if (cached && cached.mtimeMs === info.mtimeMs) return cached.html;
    const html = await readFile(MAP_FILE, 'utf8');
    cached = { mtimeMs: info.mtimeMs, html };
    return html;
  } catch {
    return null;
  }
}

function sign(payload: string): string {
  return createHmac('sha256', TICKET_KEY).update(payload).digest('base64url');
}

export function createFloorplanTicket(): { token: string; expiresAtISO: string } {
  const expiresAt = Date.now() + TICKET_TTL_MS;
  const payload = `${expiresAt}.${randomBytes(12).toString('base64url')}`;
  return { token: `${payload}.${sign(payload)}`, expiresAtISO: new Date(expiresAt).toISOString() };
}

export function isFloorplanTicketValid(token: unknown): boolean {
  if (typeof token !== 'string' || token.length > 200) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expiresAtRaw = '', nonce = '', signature = ''] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !nonce || !signature) return false;

  const expected = Buffer.from(sign(`${expiresAtRaw}.${nonce}`));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
