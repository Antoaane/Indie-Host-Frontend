import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/**
 * Distance d'un point à la côte la plus proche, sans aucun appel extérieur.
 *
 * Le tracé vient des terres Natural Earth au 1:10 000 000 (domaine public), livrées par le paquet
 * `world-atlas` (`land-10m.json`, TopoJSON). Sa précision est de l'ordre du kilomètre : assez pour
 * dire « près de la mer » ou non, pas pour mesurer une distance à la plage. Les lacs ne sont pas des
 * côtes ; les estuaires en font partie.
 *
 * Le fichier (3 Mo) n'est lu qu'au premier calcul, puis gardé en mémoire sous forme de segments
 * rangés dans une grille d'un demi-degré (environ 7 Mo).
 */

const KM_PER_DEGREE = 111.195;
const CELL_DEGREES = 0.5;
// Un segment plus large que cela traverse l'antiméridien : il couvrirait toute la grille.
const MAX_CELLS_PER_SEGMENT = 4;

type Topology = {
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: Array<Array<[number, number]>>;
};

/** Par case de la grille : segments à plat `[lon1, lat1, lon2, lat2, …]`. */
let coastIndex: Map<string, Float32Array> | null = null;

function cellKey(column: number, row: number): string {
  return `${column}:${row}`;
}

function loadCoastIndex(): Map<string, Float32Array> {
  if (coastIndex) return coastIndex;

  const require = createRequire(import.meta.url);
  const topology = JSON.parse(readFileSync(require.resolve('world-atlas/land-10m.json'), 'utf8')) as Topology;
  const scale = topology.transform?.scale ?? [1, 1];
  const translate = topology.transform?.translate ?? [0, 0];
  const buckets = new Map<string, number[]>();

  for (const arc of topology.arcs) {
    // Les arcs TopoJSON sont des écarts entiers cumulés, à remettre à l'échelle.
    let x = 0;
    let y = 0;
    let previousLon = 0;
    let previousLat = 0;
    let hasPrevious = false;

    for (const [dx, dy] of arc) {
      x += dx;
      y += dy;
      const lon = x * scale[0] + translate[0];
      const lat = y * scale[1] + translate[1];

      if (hasPrevious) {
        const minColumn = Math.floor(Math.min(previousLon, lon) / CELL_DEGREES);
        const maxColumn = Math.floor(Math.max(previousLon, lon) / CELL_DEGREES);
        const minRow = Math.floor(Math.min(previousLat, lat) / CELL_DEGREES);
        const maxRow = Math.floor(Math.max(previousLat, lat) / CELL_DEGREES);

        if (maxColumn - minColumn <= MAX_CELLS_PER_SEGMENT) {
          for (let column = minColumn; column <= maxColumn; column += 1) {
            for (let row = minRow; row <= maxRow; row += 1) {
              const key = cellKey(column, row);
              let bucket = buckets.get(key);
              if (!bucket) {
                bucket = [];
                buckets.set(key, bucket);
              }
              bucket.push(previousLon, previousLat, lon, lat);
            }
          }
        }
      }

      previousLon = lon;
      previousLat = lat;
      hasPrevious = true;
    }
  }

  const index = new Map<string, Float32Array>();
  for (const [key, bucket] of buckets) index.set(key, Float32Array.from(bucket));
  coastIndex = index;
  return index;
}

/**
 * Distance en kilomètres à la côte la plus proche, ou `Infinity` s'il n'y en a aucune à moins de
 * `searchRadiusKm`. Lève une erreur si le tracé des côtes ne peut pas être chargé.
 */
export function distanceToCoastKm(latitude: number, longitude: number, searchRadiusKm = 30): number {
  const index = loadCoastIndex();
  // Près des pôles un degré de longitude ne vaut presque rien : on borne pour garder une recherche finie.
  const cosLatitude = Math.max(Math.cos((latitude * Math.PI) / 180), 0.05);
  const reachLat = searchRadiusKm / KM_PER_DEGREE;
  const reachLon = searchRadiusKm / (KM_PER_DEGREE * cosLatitude);

  let best = Infinity;

  for (let column = Math.floor((longitude - reachLon) / CELL_DEGREES); column <= Math.floor((longitude + reachLon) / CELL_DEGREES); column += 1) {
    for (let row = Math.floor((latitude - reachLat) / CELL_DEGREES); row <= Math.floor((latitude + reachLat) / CELL_DEGREES); row += 1) {
      const bucket = index.get(cellKey(column, row));
      if (!bucket) continue;

      for (let offset = 0; offset < bucket.length; offset += 4) {
        // Projection plane locale, en kilomètres, centrée sur le point : exacte à mieux que 1 % à ces distances.
        const ax = (bucket[offset]! - longitude) * KM_PER_DEGREE * cosLatitude;
        const ay = (bucket[offset + 1]! - latitude) * KM_PER_DEGREE;
        const bx = (bucket[offset + 2]! - longitude) * KM_PER_DEGREE * cosLatitude;
        const by = (bucket[offset + 3]! - latitude) * KM_PER_DEGREE;
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSquared = dx * dx + dy * dy;
        const along = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
        const distance = Math.hypot(ax + along * dx, ay + along * dy);
        if (distance < best) best = distance;
      }
    }
  }

  return best <= searchRadiusKm ? best : Infinity;
}
