// Vérification rapide de la protection contre un flux iCal vide (`domains/calendar/emptyFeedGuard.ts`).
// Lancer : npx tsx backend/api/scripts/calendar-guard-smoke.ts
import assert from 'node:assert/strict';

import { isSuspiciousEmptyFeed } from '../src/domains/calendar/emptyFeedGuard.js';

const now = Date.parse('2026-11-11T12:00:00.000Z');
const future = { endDate: new Date('2026-11-22T00:00:00.000Z'), status: 'confirmed' };
const past = { endDate: new Date('2026-11-01T00:00:00.000Z'), status: 'confirmed' };
const cancelled = { endDate: new Date('2027-01-10T00:00:00.000Z'), status: 'CANCELLED' };

// Cas du 2026-11-11 : Booking renvoie un calendrier vide alors qu'il fermait encore des dates.
assert.equal(isSuspiciousEmptyFeed([future, past], 0, now), true, 'flux vide, dates à venir : gardées');

// Le flux contient encore quelque chose : il est appliqué tel quel.
assert.equal(isSuspiciousEmptyFeed([future], 1, now), false, 'flux non vide : appliqué');

// Plus rien à venir (séjours passés, événements annulés) : un flux vide est normal.
assert.equal(isSuspiciousEmptyFeed([past], 0, now), false, 'seulement du passé : appliqué');
assert.equal(isSuspiciousEmptyFeed([cancelled], 0, now), false, 'seulement des annulations : appliqué');

// Première importation : rien d'enregistré, rien à protéger.
assert.equal(isSuspiciousEmptyFeed([], 0, now), false, 'première importation : appliquée');

console.log('calendar-guard-smoke : 5 cas OK');
