// Flux iCal arrivé vide alors que la source bloquait encore des dates à venir : il n'est pas appliqué.
//
// Le 2026-11-11, le flux exporté par Booking pour « Raisins Clairs » est revenu vide alors qu'il
// fermait encore 17 mois de dates. L'appliquer aurait rouvert ces dates sur IndieHost, puis chez
// Booking, qui importe le flux d'IndieHost. Un flux entièrement vide est la signature d'une panne
// de la plateforme, ou de dates fermées chez elle seulement par un calendrier importé : on garde les
// jours bloqués et on signale l'erreur. L'hôte qui a vraiment rouvert ses dates supprime ce
// calendrier puis l'ajoute de nouveau (une première importation n'est jamais bloquée).
//
// Module sans dépendance pour être vérifié seul : `npx tsx backend/api/scripts/calendar-guard-smoke.ts`.

export const EMPTY_FEED_ERROR_MESSAGE =
  'Ce calendrier est arrivé vide alors qu’il bloquait encore des dates à venir : elles restent bloquées sur IndieHost. '
  + 'Si vous les avez vraiment rouvertes, supprimez ce calendrier puis ajoutez-le de nouveau.';

type StoredEvent = {
  endDate: Date;
  status: string | null;
};

function isBlockingStatus(status: string | null): boolean {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized !== 'cancelled' && normalized !== 'canceled';
}

/**
 * @param previousEvents Événements que la source a enregistrés lors de sa dernière synchronisation.
 * @param nextEventCount Nombre d'événements du flux qui vient d'arriver.
 */
export function isSuspiciousEmptyFeed(previousEvents: StoredEvent[], nextEventCount: number, now: number = Date.now()): boolean {
  if (nextEventCount > 0) return false;
  return previousEvents.some((event) => isBlockingStatus(event.status) && event.endDate.getTime() > now);
}
