// IndexNow : signale à Bing (et aux moteurs qui partagent le protocole) les pages d'un site d'hôte
// qui viennent de changer. Google ne l'utilise pas : pour lui, c'est le sitemap envoyé par la
// Search Console (`searchConsole.ts`).
//
// La clé est publique (servie sur chaque site, `/<clé>.txt`). Elle est dérivée d'un secret de l'API
// pour rester stable d'un démarrage à l'autre sans réglage : `INDEXNOW_KEY` la remplace si besoin.

import { createHmac } from 'node:crypto';

import { env } from '../../config/env.js';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10_000;

export function indexNowKey(): string {
  const configured = env.INDEXNOW_KEY.trim();
  if (/^[a-zA-Z0-9-]{8,128}$/.test(configured)) return configured;
  return createHmac('sha256', env.BOOKING_GUIDE_ACCESS_SECRET).update('indiehost:indexnow').digest('hex').slice(0, 32);
}

/** Envoi réservé à la production : en développement, les adresses ne sont pas publiques. */
export function isIndexNowEnabled(): boolean {
  return env.NODE_ENV === 'production' && env.INDEXNOW_ENABLED;
}

export async function submitIndexNow(host: string, urls: string[]): Promise<void> {
  if (!urls.length) return;
  const key = indexNowKey();
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList: urls.slice(0, MAX_URLS_PER_REQUEST),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  // 200 : reçu ; 202 : reçu, clé en cours de vérification. Le reste est une erreur.
  if (response.status !== 200 && response.status !== 202) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    throw new Error(`IndexNow ${response.status}${detail ? ` : ${detail}` : ''}`);
  }
}
