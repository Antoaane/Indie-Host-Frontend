// File: plugins/local-json-data/vite-plugin-local-json-data.ts

import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

type ListingResourceKey = 'core' | 'medias' | 'bookings' | 'arrival' | 'notes' | 'comments' | 'host';

type DatasetPaths = {
  dir: string;
  core: string;
  medias: string;
  bookings: string;
  arrival: string;
  notes: string;
  comments: string;
  host: string;
};

const LOCAL_JSON_BASE = '/__local-json';
const CONTENT_ROOT = path.resolve(process.cwd(), 'src/content/fr');
const USER_PROFILE_PATH = path.join(CONTENT_ROOT, 'user', 'user.json');
const RESOURCE_KEYS: ListingResourceKey[] = ['core', 'medias', 'bookings', 'arrival', 'notes', 'comments', 'host'];
const HOST_RESOURCE_TEMPLATE = {
  name: '',
  status: '',
  seniority: 0,
  'global-note': 0,
  avatar: '',
  'catalog-link': '',
};

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload, null, 2));
}

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath: string, payload: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function resolveCanonicalHostResource() {
  if (!fs.existsSync(USER_PROFILE_PATH)) {
    return { ...HOST_RESOURCE_TEMPLATE };
  }

  try {
    const user = readJson(USER_PROFILE_PATH);
    const publicProfile = user?.hosting?.publicProfile ?? {};

    return {
      ...HOST_RESOURCE_TEMPLATE,
      name: parseText(publicProfile.displayName, HOST_RESOURCE_TEMPLATE.name),
      status: parseText(publicProfile.badge, HOST_RESOURCE_TEMPLATE.status),
      seniority: Math.max(0, Math.round(parseNumber(publicProfile.experienceMonths, HOST_RESOURCE_TEMPLATE.seniority))),
      'global-note': Number(parseNumber(publicProfile.rating, HOST_RESOURCE_TEMPLATE['global-note']).toFixed(2)),
      avatar: parseText(publicProfile.avatarUrl, HOST_RESOURCE_TEMPLATE.avatar),
      'catalog-link': parseText(publicProfile.catalogUrl, HOST_RESOURCE_TEMPLATE['catalog-link']),
    };
  } catch (err) {
    console.log('[LocalJSON] failed to resolve user profile host', err);
    return { ...HOST_RESOURCE_TEMPLATE };
  }
}

function listDatasetDirs(): string[] {
  if (!fs.existsSync(CONTENT_ROOT)) return [];
  return fs
    .readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((dirName) => fs.existsSync(path.join(CONTENT_ROOT, dirName, 'core.json')));
}

function getDatasetPaths(dirName: string): DatasetPaths {
  const dir = path.join(CONTENT_ROOT, dirName);
  return {
    dir,
    core: path.join(dir, 'core.json'),
    medias: path.join(dir, 'medias.json'),
    bookings: path.join(dir, 'bookings.json'),
    arrival: path.join(dir, 'arrival.json'),
    notes: path.join(dir, 'notes.json'),
    comments: path.join(dir, 'comments.json'),
    host: path.join(dir, 'host.json'),
  };
}

function findDatasetByListingId(listingId: string): DatasetPaths | null {
  const dirs = listDatasetDirs();
  for (const dirName of dirs) {
    const paths = getDatasetPaths(dirName);
    if (!fs.existsSync(paths.core)) continue;
    const core = readJson(paths.core);
    if (core?.id === listingId) return paths;
  }
  return null;
}

function normalizeResourceKey(key: string): ListingResourceKey | null {
  if (RESOURCE_KEYS.includes(key as ListingResourceKey)) return key as ListingResourceKey;
  return null;
}

function deepMerge(target: any, patch: any): any {
  if (patch === null || patch === undefined) return patch;
  if (Array.isArray(patch)) return patch;
  if (typeof patch !== 'object') return patch;

  const base = (target && typeof target === 'object' && !Array.isArray(target)) ? target : {};
  const next: Record<string, any> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value) || value === null || typeof value !== 'object') {
      next[key] = value;
    } else {
      next[key] = deepMerge(base[key], value);
    }
  }

  return next;
}

function buildFallbackResource(resource: ListingResourceKey, listingId: string): any {
  switch (resource) {
    case 'core':
      return { id: listingId, status: 'published', pause_message: '' };
    case 'bookings':
      return { price: 0, fees: [], 'booked-days': [], reservations: [] };
    case 'arrival':
      return {
        intro: {
          title: 'Bienvenue',
          subtitle: 'Pour profiter des lieux au maximum, voici votre guide d’arrivée.',
          tagline: 'Propulsé par IndieHost',
        },
        practical: {
          savings: {
            message: 'Réservez en direct pour éviter les commissions.',
          },
          access: {
            address: 'Baurech, Nouvelle-Aquitaine (adresse complète envoyée 24h avant l’arrivée).',
            checkIn: 'À partir de 16h — arrivée autonome possible.',
            checkOut: 'Avant 11h — merci de laisser les clés au point indiqué.',
            parking: 'Gratuit sur place (1 à 2 véhicules).',
          },
          services: {
            wifi: 'Nom du réseau et mot de passe disponibles sur place.',
            contacts: 'Urgences 112 · Médecin 15 · Police 17.',
            assistance: 'Assistance hôte disponible de 9h à 21h par message.',
          },
          rules:
            '<ul>\\n  <li><strong>Respect de la nature</strong> — merci de ne rien laisser sur place et de trier vos déchets.</li>\\n  <li><strong>Silence</strong> — après 22h, merci de préserver la quiétude des lieux.</li>\\n  <li><strong>Départ</strong> — laissez le logement dans l’état trouvé et fermez bien.</li>\\n</ul>',
          shops:
            '<ul>\\n  <li><strong>Épicerie</strong> — à 10 minutes en voiture (produits frais et locaux).</li>\\n  <li><strong>Marché</strong> — le samedi matin, idéal pour découvrir la région.</li>\\n</ul>',
        },
        guide: {
          title: 'Découvertes locales',
          content:
            '<h3>Patrimoine &amp; culture</h3>\\n<ul>\\n  <li><strong>Église Saint-Saturnin</strong> — édifice roman classé, à quelques minutes.</li>\\n  <li><strong>Château de Langoiran</strong> — vue panoramique sur la vallée.</li>\\n</ul>\\n<h3>Vignobles &amp; dégustations</h3>\\n<ul>\\n  <li><strong>Château Haut Peyrat</strong> — visites guidées et dégustations.</li>\\n  <li><strong>Domaine de Saint-Amand</strong> — vins bio et ateliers œnologiques.</li>\\n</ul>\\n<h3>Balades &amp; nature</h3>\\n<ul>\\n  <li><strong>Piste Roger Lapébie</strong> — ancienne voie ferrée aménagée.</li>\\n  <li><strong>Bord du lac</strong> — promenade calme au coucher du soleil.</li>\\n</ul>\\n<h3>Activités nautiques</h3>\\n<ul>\\n  <li><strong>Base nautique</strong> — paddle, canoë et bouées tractées.</li>\\n</ul>',
        },
      };
    case 'medias':
      return { images: [], videos: [] };
    case 'notes':
      return { note: null };
    case 'comments':
      return { comments: [] };
    case 'host':
      return resolveCanonicalHostResource();
    default:
      return {};
  }
}

function buildListingCard(paths: DatasetPaths) {
  const core = fs.existsSync(paths.core) ? readJson(paths.core) : {};
  const medias = fs.existsSync(paths.medias) ? readJson(paths.medias) : {};
  const bookings = fs.existsSync(paths.bookings) ? readJson(paths.bookings) : {};
  const notes = fs.existsSync(paths.notes) ? readJson(paths.notes) : {};

  return {
    listingId: core.id,
    title: core.title,
    status: core.status,
    coverSrc: medias?.images?.[0]?.src,
    images: medias?.images,
    guestCapacity: core.guest_capacity,
    pricePerNight: bookings.price,
    rating: notes?.note?.note ?? notes?.note,
  };
}

function synchronizeDatasetHostsWithCanonicalProfile() {
  const canonicalHost = resolveCanonicalHostResource();
  const datasets = listDatasetDirs();

  datasets.forEach((dirName) => {
    const hostPath = getDatasetPaths(dirName).host;
    const currentHost = fs.existsSync(hostPath) ? readJson(hostPath) : null;

    if (JSON.stringify(currentHost) !== JSON.stringify(canonicalHost)) {
      writeJson(hostPath, canonicalHost);
    }
  });
}

async function readBody(req: any): Promise<any> {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf-8');
    });
    req.on('end', () => {
      if (!data) return resolve(null);
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err: unknown) => reject(err));
  });
}

export default function localJsonDataPlugin(): Plugin {
  return {
    name: 'vite-local-json-data',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        if (!req.url.startsWith(LOCAL_JSON_BASE)) return next();

        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname;
        const method = req.method ?? 'GET';

        console.log('[LocalJSON] request', method, pathname);

        const relative = pathname.slice(LOCAL_JSON_BASE.length);
        const parts = relative.split('/').filter(Boolean);

        try {
          synchronizeDatasetHostsWithCanonicalProfile();

          if (parts.length === 1 && parts[0] === 'listings' && method === 'GET') {
            const dirs = listDatasetDirs();
            const cards = dirs.map((dirName) => buildListingCard(getDatasetPaths(dirName))).filter((card) => card.listingId);
            return sendJson(res, 200, cards);
          }

          if (parts.length === 3 && parts[0] === 'user' && parts[2] === 'listings' && method === 'GET') {
            const userId = parts[1];
            console.log('[LocalJSON] fetch listings for user', userId);
            const dirs = listDatasetDirs();
            const cards = dirs.map((dirName) => buildListingCard(getDatasetPaths(dirName))).filter((card) => card.listingId);
            return sendJson(res, 200, cards);
          }

          if (parts.length >= 3 && parts[0] === 'listings') {
            const resource = normalizeResourceKey(parts[1]);
            const listingId = parts[2];

            if (!resource) {
              return sendJson(res, 400, { error: 'Unknown resource' });
            }

            let dataset = findDatasetByListingId(listingId);

            if (!dataset) {
              console.log('[LocalJSON] listing not found, creating fallback dataset', listingId);
              const templateDir = listDatasetDirs()[0] ?? 'ListingTest_0';
              const safeDirName = `ListingTest_${Date.now()}`;
              const newDir = path.join(CONTENT_ROOT, safeDirName);
              ensureDir(newDir);

              const templatePaths = getDatasetPaths(templateDir);
              const newPaths = getDatasetPaths(safeDirName);

              RESOURCE_KEYS.forEach((key) => {
                const sourcePath = templatePaths[key];
                const destPath = newPaths[key];
                if (key === 'host') {
                  writeJson(destPath, resolveCanonicalHostResource());
                  return;
                }
                if (fs.existsSync(sourcePath)) {
                  fs.copyFileSync(sourcePath, destPath);
                } else {
                  writeJson(destPath, buildFallbackResource(key, listingId));
                }
              });

              const core = readJson(newPaths.core);
              core.id = listingId;
              writeJson(newPaths.core, core);

              dataset = newPaths;
            }

            const resourcePath = dataset[resource];

            if (method === 'GET') {
              if (resource === 'host') {
                const canonicalHost = resolveCanonicalHostResource();
                const currentHost = fs.existsSync(resourcePath) ? readJson(resourcePath) : null;
                if (JSON.stringify(currentHost) !== JSON.stringify(canonicalHost)) {
                  writeJson(resourcePath, canonicalHost);
                }
                return sendJson(res, 200, canonicalHost);
              }

              if (fs.existsSync(resourcePath)) {
                return sendJson(res, 200, readJson(resourcePath));
              }
              const fallback = buildFallbackResource(resource, listingId);
              writeJson(resourcePath, fallback);
              return sendJson(res, 200, fallback);
            }

            if (method === 'PATCH') {
              if (resource === 'host') {
                const canonicalHost = resolveCanonicalHostResource();
                writeJson(resourcePath, canonicalHost);
                console.log('[LocalJSON] patched resource host ignored to preserve canonical user host');
                return sendJson(res, 200, canonicalHost);
              }

              const payload = await readBody(req);
              const current = fs.existsSync(resourcePath) ? readJson(resourcePath) : buildFallbackResource(resource, listingId);
              const next = deepMerge(current, payload ?? {});
              writeJson(resourcePath, next);
              console.log('[LocalJSON] patched resource', resource, listingId);
              return sendJson(res, 200, next);
            }
          }

          if (parts.length === 1 && parts[0] === 'listings' && method === 'POST') {
            const payload = await readBody(req);
            const listingId = payload?.core?.id ?? `listing-${Date.now()}`;
            const newDirName = `ListingTest_${Date.now()}`;
            const newPaths = getDatasetPaths(newDirName);
            ensureDir(newPaths.dir);

            RESOURCE_KEYS.forEach((key) => {
              const fallback = buildFallbackResource(key, listingId);
              const seeded = key === 'host'
                ? resolveCanonicalHostResource()
                : payload?.[key] ? deepMerge(fallback, payload[key]) : fallback;
              writeJson(newPaths[key], seeded);
            });

            console.log('[LocalJSON] created listing', listingId, '->', newDirName);
            return sendJson(res, 201, { listingId });
          }

          return sendJson(res, 404, { error: 'Not found' });
        } catch (err: any) {
          console.log('[LocalJSON] error', err);
          return sendJson(res, 500, { error: err?.message ?? 'Server error' });
        }
      });
    },
  };
}
