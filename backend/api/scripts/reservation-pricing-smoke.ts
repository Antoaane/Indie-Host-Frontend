// Le total d'un séjour est calculé deux fois : par le site (ce que le voyageur voit) et par l'API
// (ce qu'elle accepte de faire payer). Ce contrôle compare les deux sur une série de séjours, puis
// vérifie les paliers selon le nombre de voyageurs et la fenêtre de réservation.
//
//   cd backend/api && npx tsx --tsconfig ../../frontend/tsconfig.json scripts/reservation-pricing-smoke.ts
//
// `--tsconfig` sert à lire l'alias `@/` des fichiers du site.
import assert from 'node:assert/strict';
import {
  computeReservationTotal,
  resolveBookingHorizonMonths,
  resolveLastBookableDate,
} from '../src/domains/payments/reservationPricing.js';
import { resolveWeekendPricing } from '../../../frontend/src/domain/listings/pricing.js';
import {
  computeReservationPricing,
  resolveLastBookableDate as resolveSiteLastBookableDate,
  resolveListingReservationRules,
  validateReservationAgainstRules,
} from '../../../frontend/src/domain/listings/reservationRules.js';

type Bookings = Record<string, unknown>;
type Occupants = { adults: number; children: number };

function siteTotal(core: Record<string, unknown>, bookings: Bookings, startISO: string, endISO: string, occupants: Occupants) {
  const rules = resolveListingReservationRules({ core, bookings });
  const basePrice = Number(bookings.price ?? 0) || 0;
  return computeReservationPricing({
    startISO,
    endISO,
    basePrice,
    weekendPricing: resolveWeekendPricing((bookings.pricing ?? null) as never, basePrice),
    fees: bookings.fees,
    occupants: { ...occupants, babies: 0, animals: 0, pmr: 0 },
    rules,
  });
}

function apiTotal(core: Record<string, unknown>, bookings: Bookings, startISO: string, endISO: string, occupants: Occupants) {
  return computeReservationTotal({ core, bookings, startISO, endISO, occupants });
}

// 1. Paliers de l'exemple : 1 voyageur au prix de base, 2 voyageurs +10 %, 3 voyageurs +15 %.
const core = { guest_capacity: 5 };
const tiered: Bookings = {
  price: 45,
  fees: [{ name: 'Frais de ménage', amount: 25 }],
  pricing: {
    guestTiers: [
      { guests: 2, percent: 10 },
      { guests: 3, percent: 15 },
    ],
  },
};
// Du lundi 7 au mercredi 9 décembre 2026 : deux nuits de semaine.
const twoNights = ['2026-12-07', '2026-12-09'] as const;

assert.equal(siteTotal(core, tiered, ...twoNights, { adults: 1, children: 0 }).total, 2 * 45 + 25);
assert.equal(siteTotal(core, tiered, ...twoNights, { adults: 2, children: 0 }).total, 2 * 50 + 25, '45 € + 10 % = 49,5 € arrondis à 50 €');
assert.equal(siteTotal(core, tiered, ...twoNights, { adults: 2, children: 1 }).total, 2 * 52 + 25, '45 € + 15 % = 51,75 € arrondis à 52 €');
// Sans ligne pour 4 et 5 voyageurs : le palier de 3 continue.
assert.equal(siteTotal(core, tiered, ...twoNights, { adults: 4, children: 1 }).total, 2 * 52 + 25);
assert.equal(siteTotal(core, tiered, ...twoNights, { adults: 2, children: 0 }).nightly.weekdayPrice, 50);
assert.equal(siteTotal(core, tiered, ...twoNights, { adults: 2, children: 0 }).guestTierPercent, 10);

// 2. Un palier au-delà de la capacité, ou pour un seul voyageur, est ignoré des deux côtés.
const outOfRange: Bookings = {
  price: 100,
  pricing: { guestTiers: [{ guests: 1, percent: 50 }, { guests: 9, percent: 80 }, { guests: 2, percent: 300 }] },
};
assert.equal(siteTotal({ guest_capacity: 4 }, outOfRange, ...twoNights, { adults: 1, children: 0 }).total, 200);
// 300 % est ramené au plafond de 200 % : 100 € deviennent 300 €.
assert.equal(siteTotal({ guest_capacity: 4 }, outOfRange, ...twoNights, { adults: 4, children: 0 }).total, 600);

// 3. Le site et l'API donnent le même total, quels que soient les réglages.
const variants: Bookings[] = [
  tiered,
  outOfRange,
  { price: 45 },
  {
    price: 89,
    fees: [{ name: 'Ménage', amount: 40 }, { name: 'Linge', amount: 15 }],
    pricing: {
      weekend: { enabled: true, price: 119, percent: 34 },
      stay: { durationDiscounts: [{ minNights: 7, percent: 10 }, { minNights: 28, percent: 25 }] },
      guestTiers: [{ guests: 2, percent: 7 }, { guests: 3, percent: 13 }, { guests: 4, percent: 0 }, { guests: 5, percent: 33 }],
      extraGuests: { price: 12, threshold: 4 },
    },
  },
  {
    price: 61,
    pricing: {
      weekend: { enabled: true, price: 61 },
      guestTiers: [{ guests: 3, percent: 199 }, { guests: 3, percent: 21 }, { guests: '4', percent: '9' }, null, 'x'],
    },
  },
];
const ranges: Array<[string, string]> = [
  ['2026-12-07', '2026-12-09'],
  ['2026-12-04', '2026-12-07'],
  ['2026-12-01', '2026-12-12'],
  ['2027-02-01', '2027-03-05'],
];
let compared = 0;
for (const bookings of variants) {
  for (const capacity of [1, 2, 3, 5, 8]) {
    for (const [startISO, endISO] of ranges) {
      for (let adults = 1; adults <= capacity; adults += 1) {
        for (const children of [0, 1]) {
          if (adults + children > capacity) continue;
          const occupants = { adults, children };
          const listingCore = { guest_capacity: capacity };
          assert.equal(
            apiTotal(listingCore, bookings, startISO, endISO, occupants),
            siteTotal(listingCore, bookings, startISO, endISO, occupants).total,
            `total différent pour ${JSON.stringify({ bookings, capacity, startISO, endISO, occupants })}`,
          );
          compared += 1;
        }
      }
    }
  }
}

// 4. Fenêtre de réservation : 24 mois sans réglage, bornée de 1 à 24.
const horizonOf = (value: unknown) => resolveBookingHorizonMonths({ pricing: { stay: { bookingHorizonMonths: value } } });
assert.equal(resolveBookingHorizonMonths({}), 24);
assert.equal(horizonOf(null), 24);
assert.equal(horizonOf(0), 24);
assert.equal(horizonOf(12), 12);
assert.equal(horizonOf('6'), 6);
assert.equal(horizonOf(60), 24);
assert.equal(resolveListingReservationRules({ bookings: { pricing: { stay: { bookingHorizonMonths: 12 } } } }).stay.bookingHorizonMonths, 12);
assert.equal(resolveListingReservationRules({}).stay.bookingHorizonMonths, 24);

// Le site compte à partir du jour du voyageur, l'API à partir du lendemain UTC (un jour de marge).
assert.equal(resolveSiteLastBookableDate(24, '2026-11-26'), '2028-11-26');
assert.equal(resolveSiteLastBookableDate(3, '2026-11-30'), '2027-02-28', 'le 30 février n’existe pas : fin du mois');
assert.equal(resolveSiteLastBookableDate(12, '2028-02-29'), '2029-02-28');
assert.equal(resolveLastBookableDate(24, new Date('2026-11-26T10:00:00Z')), '2028-11-27');
assert.equal(resolveLastBookableDate(12, new Date('2026-12-31T23:30:00Z')), '2028-01-01');

// Un séjour qui finit après la fenêtre est refusé par le site avant le paiement.
const shortWindow = resolveListingReservationRules({
  core: { guest_capacity: 2 },
  bookings: { price: 45, pricing: { stay: { minNights: 1, bookingHorizonMonths: 3 } } },
});
const today = new Date();
const inDays = (days: number) => new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + days)).toISOString().slice(0, 10);
const near = validateReservationAgainstRules({ startISO: inDays(10), endISO: inDays(12), occupants: { adults: 2 }, rules: shortWindow });
const far = validateReservationAgainstRules({ startISO: inDays(200), endISO: inDays(202), occupants: { adults: 2 }, rules: shortWindow });
assert.deepEqual(near.errors, []);
assert.equal(far.errors.length, 1);
assert.match(far.errors[0], /ouvertes jusqu/);

console.log(`reservation-pricing-smoke : OK (${compared} séjours comparés entre le site et l'API)`);
