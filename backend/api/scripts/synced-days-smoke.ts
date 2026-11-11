// Contrôle rapide de `preserveSyncedBookedDays` : npx tsx scripts/synced-days-smoke.ts
import assert from 'node:assert/strict';
import { deepMerge } from '../src/lib/json.js';
import { preserveSyncedBookedDays } from '../src/domains/listings/syncedBookedDays.js';

const booking1 = { start: '2026-11-13', end: '2026-11-22' };
const booking2 = { start: '2026-12-07', end: '2028-05-11' };
const manual = { start: '2027-01-10', end: '2027-01-12' };

const server = {
  price: 45,
  'booked-days': [booking1, booking2],
  'external-booked-days': [booking1, booking2],
  reservations: [],
};

function apply(patch: Record<string, unknown>) {
  return preserveSyncedBookedDays(server, patch, deepMerge(server, patch) as Record<string, unknown>);
}

// 1. Brouillon ancien de l'éditeur : listes vides. Les jours Booking restent.
let result = apply({ price: 50, 'booked-days': [], 'external-booked-days': [], reservations: [] });
assert.deepEqual(result['external-booked-days'], [booking1, booking2]);
assert.deepEqual(result['booked-days'], [booking1, booking2]);
assert.equal(result.price, 50);

// 2. Blocage manuel ajouté par l'hôte sur une copie à jour : gardé, avec les jours Booking.
result = apply({ 'booked-days': [booking1, booking2, manual], 'external-booked-days': [booking1, booking2] });
assert.deepEqual(result['booked-days'], [manual, booking1, booking2]);

// 3. Copie du site qui connaît encore un jour importé que Booking a retiré depuis : il ne devient
//    pas un blocage manuel.
const serverAfterSync = { ...server, 'booked-days': [booking2], 'external-booked-days': [booking2] };
result = preserveSyncedBookedDays(
  serverAfterSync,
  { 'booked-days': [booking1, booking2], 'external-booked-days': [booking1, booking2] },
  deepMerge(serverAfterSync, { 'booked-days': [booking1, booking2], 'external-booked-days': [booking1, booking2] }) as Record<string, unknown>,
);
assert.deepEqual(result['booked-days'], [booking2]);
assert.deepEqual(result['external-booked-days'], [booking2]);

// 4. Mise à jour sans jours bloqués (un tarif) : ceux du serveur restent tels quels.
result = apply({ price: 60 });
assert.deepEqual(result['booked-days'], [booking1, booking2]);
assert.deepEqual(result['external-booked-days'], [booking1, booking2]);

console.log('preserveSyncedBookedDays : 4 cas vérifiés');
