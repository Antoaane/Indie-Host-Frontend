// File: plugins/local-json-data/vite-plugin-local-json-data.ts

import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

type ListingResourceKey = 'core' | 'medias' | 'bookings' | 'notes' | 'comments' | 'host';

type DatasetPaths = {
  dir: string;
  core: string;
  medias: string;
  bookings: string;
  notes: string;
  comments: string;
  host: string;
};

const LOCAL_JSON_BASE = '/__local-json';
const CONTENT_ROOT = path.resolve(process.cwd(), 'src/content/fr');
const RESOURCE_KEYS: ListingResourceKey[] = ['core', 'medias', 'bookings', 'notes', 'comments', 'host'];

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

function listDatasetDirs(): string[] {
  if (!fs.existsSync(CONTENT_ROOT)) return [];
  return fs
    .readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function getDatasetPaths(dirName: string): DatasetPaths {
  const dir = path.join(CONTENT_ROOT, dirName);
  return {
    dir,
    core: path.join(dir, 'core.json'),
    medias: path.join(dir, 'medias.json'),
    bookings: path.join(dir, 'bookings.json'),
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
      return { id: listingId };
    case 'bookings':
      return { price: 0, fees: [], 'booked-days': [] };
    case 'medias':
      return { images: [], videos: [] };
    case 'notes':
      return { note: null };
    case 'comments':
      return { comments: [] };
    case 'host':
      return { name: '', status: '', avatar: '' };
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
              if (fs.existsSync(resourcePath)) {
                return sendJson(res, 200, readJson(resourcePath));
              }
              const fallback = buildFallbackResource(resource, listingId);
              writeJson(resourcePath, fallback);
              return sendJson(res, 200, fallback);
            }

            if (method === 'PATCH') {
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
              const seeded = payload?.[key] ? deepMerge(fallback, payload[key]) : fallback;
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
