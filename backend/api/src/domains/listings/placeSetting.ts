import { distanceToCoastKm } from '../../lib/coastline.js';

/**
 * Cadre d'un logement, déduit des coordonnées de son adresse (`core.latitude` / `core.longitude`,
 * posées par l'hôte dans le panneau « Localisation ») : près de la mer, ou dans les terres.
 *
 * La page de présentation s'en sert pour choisir son thème d'office tant que l'hôte n'a pas choisi
 * (`frontend/src/domain/listings/pageThemes.ts`, `suggestPageThemeId`) : mer → Rivage, terres ou
 * montagne → Maison, pas d'adresse → thème par défaut. Montagne et terres donnent le même thème :
 * il n'y a donc pas besoin de connaître l'altitude.
 *
 * Le résultat n'est pas stocké : le calcul est local, prend moins d'une milliseconde, et suit ainsi
 * toute correction de l'adresse sans rien avoir à recalculer.
 */
export type PlaceSetting = 'sea' | 'inland';

/** « À proximité de la mer » : la côte à moins de cette distance (seuil fixé par Nathan le 2026-11-10). */
export const SEA_PROXIMITY_KM = 10;

let warnedUnavailable = false;

function toCoordinate(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

/** `null` quand l'annonce n'a pas d'adresse exploitable : la page garde alors son thème par défaut. */
export function resolvePlaceSetting(core: Record<string, unknown>): PlaceSetting | null {
  const latitude = toCoordinate(core.latitude);
  const longitude = toCoordinate(core.longitude);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  // (0, 0) est la valeur d'une annonce dont l'adresse n'a jamais été renseignée, pas le golfe de Guinée.
  if (latitude === 0 && longitude === 0) return null;

  try {
    return distanceToCoastKm(latitude, longitude, SEA_PROXIMITY_KM) <= SEA_PROXIMITY_KM ? 'sea' : 'inland';
  } catch (error) {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.warn('[placeSetting] tracé des côtes indisponible : le thème d’office selon le lieu est désactivé.', error);
    }
    return null;
  }
}
