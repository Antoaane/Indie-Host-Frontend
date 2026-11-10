// Vérification manuelle de `src/domains/listings/placeSetting.ts` : `npx tsx scripts/place-setting-smoke.ts`
// Rejoue de vraies adresses et sort en code 1 si un lieu n'est pas classé comme attendu.
import { distanceToCoastKm } from '../src/lib/coastline.js';
import { resolvePlaceSetting, SEA_PROXIMITY_KM, type PlaceSetting } from '../src/domains/listings/placeSetting.js';

type Case = { label: string; latitude: unknown; longitude: unknown; expect: PlaceSetting | null };

const cases: Case[] = [
  // Bord de mer
  { label: 'Saint-François, Guadeloupe', latitude: 16.2526, longitude: -61.2737, expect: 'sea' },
  { label: 'Sainte-Anne, Guadeloupe', latitude: 16.2262, longitude: -61.379, expect: 'sea' },
  { label: 'La Rochelle, vieux port', latitude: 46.1558, longitude: -1.1532, expect: 'sea' },
  { label: 'Nice, centre', latitude: 43.7034, longitude: 7.2663, expect: 'sea' },
  { label: 'Biarritz', latitude: 43.4832, longitude: -1.5586, expect: 'sea' },
  { label: 'Saint-Malo intra-muros', latitude: 48.6493, longitude: -2.0257, expect: 'sea' },
  { label: 'Arcachon', latitude: 44.6523, longitude: -1.1785, expect: 'sea' },
  { label: 'Cassis', latitude: 43.214, longitude: 5.537, expect: 'sea' },
  { label: 'Porto-Vecchio', latitude: 41.591, longitude: 9.279, expect: 'sea' },
  { label: 'Île de Ré, Saint-Martin', latitude: 46.203, longitude: -1.366, expect: 'sea' },
  { label: 'Honfleur', latitude: 49.419, longitude: 0.233, expect: 'sea' },
  { label: 'Lisbonne, Alfama', latitude: 38.712, longitude: -9.13, expect: 'sea' },
  { label: 'Bayonne', latitude: 43.4929, longitude: -1.4748, expect: 'sea' },
  { label: 'Vannes', latitude: 47.6582, longitude: -2.7608, expect: 'sea' },
  // Un estuaire compte comme une côte : celui de la Gironde est à 7 km du centre de Bordeaux.
  { label: 'Bordeaux, centre (estuaire à 7 km)', latitude: 44.8378, longitude: -0.5792, expect: 'sea' },
  { label: 'Coordonnées en texte', latitude: '43.4832', longitude: '-1.5586', expect: 'sea' },
  // Dans les terres et en montagne
  // 10,02 km : juste au-delà du seuil.
  { label: 'Montpellier, centre', latitude: 43.6108, longitude: 3.8767, expect: 'inland' },
  { label: 'Perpignan', latitude: 42.6887, longitude: 2.8948, expect: 'inland' },
  { label: 'Caen', latitude: 49.1829, longitude: -0.3707, expect: 'inland' },
  { label: 'Nantes, centre', latitude: 47.2184, longitude: -1.5536, expect: 'inland' },
  { label: 'Aix-en-Provence', latitude: 43.5297, longitude: 5.4474, expect: 'inland' },
  { label: 'Chamonix', latitude: 45.9237, longitude: 6.8694, expect: 'inland' },
  { label: 'Annecy (un lac n’est pas la mer)', latitude: 45.8992, longitude: 6.1294, expect: 'inland' },
  { label: 'Dijon', latitude: 47.322, longitude: 5.0415, expect: 'inland' },
  { label: 'Paris', latitude: 48.8566, longitude: 2.3522, expect: 'inland' },
  { label: 'Font-Romeu', latitude: 42.504, longitude: 2.038, expect: 'inland' },
  { label: 'Marrakech', latitude: 31.6295, longitude: -7.9811, expect: 'inland' },
  // Pas d'adresse exploitable
  { label: 'Annonce sans adresse (0, 0)', latitude: 0, longitude: 0, expect: null },
  { label: 'Coordonnées absentes', latitude: undefined, longitude: undefined, expect: null },
  { label: 'Coordonnées vides', latitude: '', longitude: '', expect: null },
  { label: 'Latitude hors bornes', latitude: 123, longitude: 2, expect: null },
  { label: 'Valeur non numérique', latitude: 'abc', longitude: 2, expect: null },
];

let failures = 0;
const startedAt = Date.now();

for (const item of cases) {
  const actual = resolvePlaceSetting({ latitude: item.latitude, longitude: item.longitude });
  const ok = actual === item.expect;
  if (!ok) failures += 1;

  const numeric = typeof item.latitude === 'number' && typeof item.longitude === 'number' && actual !== null;
  const distance = numeric ? distanceToCoastKm(item.latitude as number, item.longitude as number, 60) : null;
  const distanceLabel = distance === null ? '' : Number.isFinite(distance) ? `${distance.toFixed(1)} km` : '> 60 km';
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${item.label.padEnd(40)} ${String(actual).padEnd(7)} ${distanceLabel}`);
}

console.log(`\n${cases.length - failures}/${cases.length} lieux classés comme attendu (seuil ${SEA_PROXIMITY_KM} km, ${Date.now() - startedAt} ms, chargement compris).`);
if (failures) process.exit(1);
