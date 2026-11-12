// Shell du site (le `index.html` construit par Vite, `#app` vide) : lu sur le conteneur du site
// (`PUBLIC_SITE_SHELL_URL`), gardé en mémoire et revalidé par ETag. Après un déploiement, le shell
// change (noms des fichiers JavaScript) : un shell périmé chargerait des fichiers qui n'existent plus.

import { env } from '../../config/env.js';

type CachedShell = { html: string; etag: string | null; checkedAt: number };

const REVALIDATE_AFTER_MS = 5_000;
const FETCH_TIMEOUT_MS = 3_000;

let cached: CachedShell | null = null;
let pending: Promise<string> | null = null;

async function fetchShell(): Promise<string> {
  const headers: Record<string, string> = { accept: 'text/html' };
  if (cached?.etag) headers['if-none-match'] = cached.etag;

  try {
    const response = await fetch(env.PUBLIC_SITE_SHELL_URL, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status === 304 && cached) {
      cached = { ...cached, checkedAt: Date.now() };
      return cached.html;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    if (!/<div\s+id="app"/i.test(html)) throw new Error('#app introuvable');
    cached = { html, etag: response.headers.get('etag'), checkedAt: Date.now() };
    return html;
  } catch (error) {
    // Site momentanément injoignable : le dernier shell connu vaut mieux que pas de page.
    if (cached) return cached.html;
    throw new Error(`[public-site] shell indisponible (${env.PUBLIC_SITE_SHELL_URL}) : ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function loadShell(): Promise<string> {
  if (cached && Date.now() - cached.checkedAt < REVALIDATE_AFTER_MS) return cached.html;
  if (!pending) pending = fetchShell().finally(() => { pending = null; });
  return pending;
}
