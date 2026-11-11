// Jours bloqués venus des calendriers importés (Airbnb, Booking…) : seule la synchronisation iCal
// (`domains/calendar/calendar.service.ts`) les écrit, dans `bookings['external-booked-days']` et
// dans `bookings['booked-days']`.
//
// Une mise à jour de la section `bookings` envoyée par le site ne doit jamais les remplacer : la
// fusion remplace les listes en entier, et l'éditeur renvoyait au clic sur « Appliquer » la copie de
// son brouillon, parfois vieille de plusieurs jours. Les jours importés disparaissaient alors du
// calendrier public (2026-11-11). Ce module rétablit les jours importés tels que le serveur les
// connaît, et ne garde de la liste envoyée que les blocages ajoutés à la main.

type DayRange = { start: string; end: string };

function readRanges(value: unknown): DayRange[] {
  if (!Array.isArray(value)) return [];

  const ranges: DayRange[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const start = typeof (item as { start?: unknown }).start === 'string' ? (item as { start: string }).start.trim() : '';
    const end = typeof (item as { end?: unknown }).end === 'string' ? (item as { end: string }).end.trim() : '';
    if (start && end) ranges.push({ start, end });
  }
  return ranges;
}

function rangeKey(range: DayRange): string {
  return `${range.start}__${range.end}`;
}

/**
 * @param current Section `bookings` enregistrée (avant la mise à jour).
 * @param patch   Mise à jour reçue du site.
 * @param merged  Résultat de la fusion de `patch` dans `current`.
 */
export function preserveSyncedBookedDays(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  merged: Record<string, unknown>,
): Record<string, unknown> {
  const serverExternal = readRanges(current['external-booked-days']);
  const result: Record<string, unknown> = { ...merged, 'external-booked-days': serverExternal };

  // La mise à jour ne touche pas aux jours bloqués : la fusion a gardé ceux du serveur.
  if (!Array.isArray(patch['booked-days'])) return result;

  // Jours importés connus du site (sa copie, peut-être ancienne) ou du serveur : ils ne sont pas
  // des blocages manuels, le serveur seul décide s'ils sont toujours d'actualité.
  const importedKeys = new Set([
    ...readRanges(patch['external-booked-days']).map(rangeKey),
    ...serverExternal.map(rangeKey),
  ]);

  const byKey = new Map<string, DayRange>();
  for (const range of readRanges(patch['booked-days'])) {
    if (!importedKeys.has(rangeKey(range))) byKey.set(rangeKey(range), range);
  }
  for (const range of serverExternal) {
    byKey.set(rangeKey(range), range);
  }

  result['booked-days'] = Array.from(byKey.values());
  return result;
}
