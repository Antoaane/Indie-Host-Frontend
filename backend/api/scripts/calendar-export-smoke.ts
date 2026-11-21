// Vérification rapide du flux iCal publié par une annonce (`exportListingCalendar`) : il ne porte que
// ce qui naît sur IndieHost (réservations, jours fermés à la main), jamais une période importée.
// Lancer : npx tsx backend/api/scripts/calendar-export-smoke.ts
import assert from 'node:assert/strict';

import type { PrismaClient } from '@prisma/client';

// Le module charge la configuration de l'API, qui exige une base : adresse factice, jamais utilisée.
process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';

const { CalendarService } = await import('../src/domains/calendar/calendar.service.js');

type Range = { start: string; end: string };
type FakeReservation = { id: string; startDate: Date; endDate: Date; guestName: string; message: string | null; payment: unknown };
type FakeEvent = { externalUid: string | null; startDate: Date; endDate: Date; status: string };

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function serviceFor(input: { bookings: Record<string, unknown>; reservations?: FakeReservation[]; importedEvents?: FakeEvent[] }) {
  const prisma = {
    listing: { findUnique: async () => ({ id: 'listing-1', bookings: input.bookings }) },
    reservation: { findMany: async () => input.reservations ?? [] },
    calendarEvent: { findMany: async () => input.importedEvents ?? [] },
  } as unknown as PrismaClient;

  return new CalendarService(prisma);
}

// Périodes publiées, en jours : « AAAAMMJJ>AAAAMMJJ libellé ».
function published(ics: string | null): string[] {
  assert.ok(ics, 'flux attendu');
  return ics.split('BEGIN:VEVENT').slice(1).map((block) => {
    const read = (name: string) => block.match(new RegExp(`^${name}[^:\\r\\n]*:(.*)$`, 'm'))?.[1]?.trim() ?? '';
    return `${read('DTSTART').slice(0, 8)}>${read('DTEND').slice(0, 8)} ${read('SUMMARY')}`;
  }).sort();
}

// Les deux moitiés de la fermeture Booking de « Raisins Clairs », relevées le 2026-11-21.
const half1: Range[] = [{ start: '2026-12-07', end: '2027-01-14' }, { start: '2027-02-01', end: '2027-03-02' }];
const asEvents = (ranges: Range[]): FakeEvent[] => ranges.map((range, index) => ({
  externalUid: `booking-${index}@booking.com`,
  startDate: day(range.start),
  endDate: day(range.end),
  status: 'confirmed',
}));

// 1. Cas du 2026-11-21 : seulement des périodes importées de Booking. Le flux est vide : rien ne
//    repart vers Booking, la boucle ne peut pas s'amorcer.
let ics = await serviceFor({
  bookings: { 'booked-days': half1, 'external-booked-days': half1, reservations: [] },
  importedEvents: asEvents(half1),
}).exportListingCalendar('listing-1');
assert.deepEqual(published(ics), [], 'aucune période importée dans le flux');
assert.ok(ics?.includes('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'), 'calendrier vide mais valide');
assert.ok(!ics?.includes('import-'), 'plus aucun identifiant import-…');

// 2. Une réservation IndieHost payée et un jour fermé à la main sortent ; la période importée et la
//    réservation annulée non.
const manual: Range = { start: '2026-11-28', end: '2026-11-30' };
ics = await serviceFor({
  bookings: {
    'booked-days': [...half1, manual, { start: '2026-11-22', end: '2026-11-25' }],
    'external-booked-days': half1,
    reservations: [],
  },
  reservations: [
    { id: 'res-paid', startDate: day('2026-11-22'), endDate: day('2026-11-25'), guestName: 'Camille Martin', message: 'Arrivée tardive', payment: {} },
    { id: 'res-canceled', startDate: day('2026-12-01'), endDate: day('2026-12-04'), guestName: 'Louis', message: null, payment: { cancellation: { status: 'canceled' } } },
  ],
  importedEvents: asEvents(half1),
}).exportListingCalendar('listing-1');
assert.deepEqual(published(ics), ['20261122>20261125 Réservé', '20261128>20261130 Indisponible']);
assert.ok(!ics?.includes('Camille') && !ics?.includes('Arrivée tardive'), 'ni nom ni message du voyageur');

// 3. Réservation saisie par l'hôte (gardée dans l'annonce, sans ligne en base) : publiée, toujours
//    sans la période importée.
ics = await serviceFor({
  bookings: {
    'booked-days': [...half1, { start: '2026-11-22', end: '2026-11-25' }],
    'external-booked-days': half1,
    reservations: [{ id: 'res-host', start: '2026-11-22', end: '2026-11-25', guestName: 'Camille' }],
  },
  importedEvents: asEvents(half1),
}).exportListingCalendar('listing-1');
assert.deepEqual(published(ics), ['20261122>20261125 Réservé']);

// 4. La synchronisation vient de remplacer les événements importés, la liste de l'annonce n'est pas
//    encore recalculée (ou l'inverse) : dans les deux cas la période reste hors du flux.
ics = await serviceFor({
  bookings: { 'booked-days': half1, 'external-booked-days': half1, reservations: [] },
  importedEvents: [],
}).exportListingCalendar('listing-1');
assert.deepEqual(published(ics), [], 'liste de l’annonce seule');
ics = await serviceFor({
  bookings: { 'booked-days': half1, 'external-booked-days': [], reservations: [] },
  importedEvents: asEvents(half1),
}).exportListingCalendar('listing-1');
assert.deepEqual(published(ics), [], 'événements en base seuls');

// 5. Annonce inconnue.
const unknown = new CalendarService({ listing: { findUnique: async () => null } } as unknown as PrismaClient);
assert.equal(await unknown.exportListingCalendar('listing-x'), null);

console.log('calendar-export-smoke : 5 cas OK');
