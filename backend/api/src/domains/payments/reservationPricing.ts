// Total d'une réservation recalculé côté serveur : le navigateur ne fixe plus le montant payé.
// Reprise à l'identique de frontend/src/domain/listings/pricing.ts (computeNightlyPriceBreakdown,
// resolveWeekendPricing) et reservationRules.ts (computeReservationPricing) : toute évolution de
// la tarification doit être faite des deux côtés, sinon les réservations sont refusées.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CAPACITY = 1;
const MAX_CAPACITY = 50;
const MAX_NIGHTS = 365;
const MAX_MONEY = 50000;
const DISCOUNT_PERCENT_MAX = 100;
const STAY_DISCOUNT_TIERS_MAX = 24;
const GUEST_SURCHARGE_PERCENT_MAX = 200;
// Fenêtre de réservation (reservationRules.ts) : 24 mois au plus, et par défaut.
const BOOKING_HORIZON_MONTHS_MAX = 24;
const BOOKING_HORIZON_MONTHS_DEFAULT = 24;

type DurationDiscountTier = {
  minNights: number;
  percent: number;
};

export type ReservationPricingOccupants = {
  adults: number;
  children: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(next)));
}

// reservationRules.ts : montant arrondi à l'euro.
function toRoundedAmount(value: unknown): number {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return 0;
  return Math.round(next);
}

// pricing.ts : montant non arrondi, avec repli.
function toAmount(value: unknown, fallback = 0): number {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return fallback;
  return next;
}

function toUtcDay(iso: string): number | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function nightsBetween(startISO: string, endISO: string): number {
  const startUtc = toUtcDay(startISO);
  const endUtc = toUtcDay(endISO);
  if (startUtc === null || endUtc === null || endUtc <= startUtc) return 0;
  return Math.round((endUtc - startUtc) / DAY_MS);
}

function countWeekendNights(startISO: string, endISO: string): number {
  const startUtc = toUtcDay(startISO);
  const endUtc = toUtcDay(endISO);
  if (startUtc === null || endUtc === null || endUtc <= startUtc) return 0;

  let total = 0;
  for (let current = startUtc; current < endUtc; current += DAY_MS) {
    const weekday = new Date(current).getUTCDay();
    if (weekday === 5 || weekday === 6) total += 1;
  }
  return total;
}

function normalizeDurationDiscountTier(input: unknown): DurationDiscountTier | null {
  if (!isPlainObject(input)) return null;

  const minNights = clampInteger(input.minNights ?? input.threshold ?? input.nights, 1, MAX_NIGHTS, 1);
  const percent = clampInteger(input.percent ?? input.discount ?? input.discountPercent, 0, DISCOUNT_PERCENT_MAX, 0);
  if (percent <= 0) return null;

  return { minNights, percent };
}

function dedupeAndSortDurationDiscountTiers(tiers: DurationDiscountTier[]): DurationDiscountTier[] {
  const byThreshold = new Map<number, DurationDiscountTier>();

  tiers.slice(0, STAY_DISCOUNT_TIERS_MAX).forEach((tier) => {
    const existing = byThreshold.get(tier.minNights);
    if (!existing || tier.percent > existing.percent) {
      byThreshold.set(tier.minNights, tier);
    }
  });

  return Array.from(byThreshold.values()).sort((a, b) => a.minNights - b.minNights);
}

function resolveDurationDiscountTiers(rawStay: Record<string, unknown>): DurationDiscountTier[] {
  const configuredTiers = Array.isArray(rawStay.durationDiscounts)
    ? rawStay.durationDiscounts
        .map((entry) => normalizeDurationDiscountTier(entry))
        .filter((entry): entry is DurationDiscountTier => Boolean(entry))
    : [];

  if (configuredTiers.length > 0) {
    return dedupeAndSortDurationDiscountTiers(configuredTiers);
  }

  const weeklyDiscount = clampInteger(rawStay.weeklyDiscount, 0, DISCOUNT_PERCENT_MAX, 0);
  const monthlyDiscount = clampInteger(rawStay.monthlyDiscount, 0, DISCOUNT_PERCENT_MAX, 0);

  const legacyTiers: DurationDiscountTier[] = [];
  if (weeklyDiscount > 0) legacyTiers.push({ minNights: 7, percent: weeklyDiscount });
  if (monthlyDiscount > 0) legacyTiers.push({ minNights: 28, percent: monthlyDiscount });

  return dedupeAndSortDurationDiscountTiers(legacyTiers);
}

function resolveAppliedDurationDiscountPercent(nights: number, tiers: DurationDiscountTier[]): number {
  if (!tiers.length || nights <= 0) return 0;

  let percent = 0;
  tiers.forEach((tier) => {
    if (nights >= tier.minNights) percent = tier.percent;
  });
  return percent;
}

function resolveWeekendPrice(pricing: Record<string, unknown>, fallbackPrice: number): number | null {
  const weekend = pricing.weekend;
  if (!isPlainObject(weekend) || !weekend.enabled) return null;
  return toAmount(weekend.price, toAmount(fallbackPrice));
}

function resolveExtraGuests(pricing: Record<string, unknown>, capacity: number) {
  const raw = isPlainObject(pricing.extraGuests) ? pricing.extraGuests : {};
  const price = clampInteger(raw.price, 0, MAX_MONEY, 0);
  const threshold = Number.isFinite(Number(raw.threshold))
    ? clampInteger(raw.threshold, 0, capacity, capacity)
    : capacity;

  return {
    enabled: price > 0 && threshold < capacity,
    price,
    threshold,
  };
}

// reservationRules.ts (resolveGuestTiers) : paliers selon le nombre de voyageurs, de 2 à la capacité ;
// deux lignes pour le même nombre, la dernière l'emporte.
function resolveGuestTiers(pricing: Record<string, unknown>, capacity: number): Array<{ guests: number; percent: number }> {
  if (!Array.isArray(pricing.guestTiers)) return [];

  const byGuests = new Map<number, number>();
  pricing.guestTiers.forEach((entry) => {
    if (!isPlainObject(entry)) return;
    const guests = Math.trunc(Number(entry.guests));
    if (!Number.isFinite(guests) || guests < 2 || guests > capacity) return;
    byGuests.set(guests, clampInteger(entry.percent, 0, GUEST_SURCHARGE_PERCENT_MAX, 0));
  });

  return Array.from(byGuests, ([guests, percent]) => ({ guests, percent })).sort((a, b) => a.guests - b.guests);
}

// reservationRules.ts (resolveGuestTierPercent) : majoration du dernier palier atteint.
function resolveGuestTierPercent(tiers: Array<{ guests: number; percent: number }>, travelers: number): number {
  let percent = 0;
  tiers.forEach((tier) => {
    if (travelers >= tier.guests) percent = tier.percent;
  });
  return percent;
}

// pricing.ts (applyGuestSurcharge) : prix par nuit majoré, arrondi à l'euro.
function applyGuestSurcharge(price: number, percent: number): number {
  if (!(percent > 0)) return price;
  return Math.round((price * (100 + percent)) / 100);
}

// reservationRules.ts (resolveBookingHorizonMonths) : valeur absente ou invalide, 24 mois.
export function resolveBookingHorizonMonths(bookings: Record<string, unknown>): number {
  const pricing = isPlainObject(bookings.pricing) ? bookings.pricing : {};
  const rawStay = isPlainObject(pricing.stay) ? pricing.stay : {};
  const value = rawStay.bookingHorizonMonths;
  if (value === null || value === undefined || value === '') return BOOKING_HORIZON_MONTHS_DEFAULT;
  const months = Math.trunc(Number(value));
  if (!Number.isFinite(months) || months < 1) return BOOKING_HORIZON_MONTHS_DEFAULT;
  return Math.min(BOOKING_HORIZON_MONTHS_MAX, months);
}

// reservationRules.ts (addMonthsToIsoDate) : même jour N mois plus tard, ramené à la fin du mois.
function addMonthsToIsoDate(iso: string, months: number): string {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

// Dernier jour de départ accepté. Le site compte à partir du jour du voyageur, le serveur du jour
// UTC : un voyageur à l'est peut être un jour en avance, d'où le jour de marge.
export function resolveLastBookableDate(bookingHorizonMonths: number, now = new Date()): string {
  const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY_MS);
  return addMonthsToIsoDate(tomorrowUtc.toISOString().slice(0, 10), bookingHorizonMonths);
}

function readRanges(value: unknown): Array<{ startUtc: number; endUtc: number }> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isPlainObject(entry) || typeof entry.start !== 'string' || typeof entry.end !== 'string') return [];
    const startUtc = toUtcDay(entry.start.trim().slice(0, 10));
    const endUtc = toUtcDay(entry.end.trim().slice(0, 10));
    if (startUtc === null || endUtc === null || endUtc <= startUtc) return [];
    return [{ startUtc, endUtc }];
  });
}

// Mêmes plages que le calendrier public : réservations en cours (une annulation retire la
// réservation du JSON), jours bloqués par l'hôte et jours importés d'Airbnb / Booking.
export function isReservationRangeAvailable(bookings: Record<string, unknown>, startISO: string, endISO: string): boolean {
  const startUtc = toUtcDay(startISO);
  const endUtc = toUtcDay(endISO);
  if (startUtc === null || endUtc === null) return false;

  const ranges = [
    ...readRanges(bookings.reservations),
    ...readRanges(bookings['booked-days']),
    ...readRanges(bookings['external-booked-days']),
  ];
  return !ranges.some((range) => startUtc < range.endUtc && range.startUtc < endUtc);
}

// Total en euros, arrondi comme dans le parcours de réservation du front.
export function computeReservationTotal({
  core,
  bookings,
  startISO,
  endISO,
  occupants,
}: {
  core: Record<string, unknown>;
  bookings: Record<string, unknown>;
  startISO: string;
  endISO: string;
  occupants: ReservationPricingOccupants;
}): number {
  const capacity = clampInteger(core.guest_capacity, DEFAULT_CAPACITY, MAX_CAPACITY, DEFAULT_CAPACITY);
  const pricing = isPlainObject(bookings.pricing) ? bookings.pricing : {};
  const rawStay = isPlainObject(pricing.stay) ? pricing.stay : {};

  const nights = Math.max(0, nightsBetween(startISO, endISO));
  const travelers = occupants.adults + occupants.children;
  const guestSurchargePercent = resolveGuestTierPercent(resolveGuestTiers(pricing, capacity), travelers);
  const baseWeekdayPrice = toRoundedAmount(bookings.price);
  const weekdayPrice = applyGuestSurcharge(baseWeekdayPrice, guestSurchargePercent);
  const weekendPricingPrice = resolveWeekendPrice(pricing, Number(bookings.price ?? 0) || 0);
  const weekendPrice = weekendPricingPrice === null
    ? weekdayPrice
    : applyGuestSurcharge(toAmount(weekendPricingPrice, baseWeekdayPrice), guestSurchargePercent);
  const weekendNights = weekendPricingPrice === null ? 0 : Math.min(nights, countWeekendNights(startISO, endISO));
  const weekdayNights = Math.max(0, nights - weekendNights);
  const nightlySubtotal = weekdayNights * weekdayPrice + weekendNights * weekendPrice;
  const discountPercent = resolveAppliedDurationDiscountPercent(nights, resolveDurationDiscountTiers(rawStay));
  const discountTotal = Math.round((nightlySubtotal * discountPercent) / 100);
  const nightlyTotal = Math.max(0, nightlySubtotal - discountTotal);

  const feesTotal = Array.isArray(bookings.fees)
    ? bookings.fees.reduce<number>((acc, fee) => acc + toRoundedAmount(isPlainObject(fee) ? fee.amount : 0), 0)
    : 0;

  const extraGuests = resolveExtraGuests(pricing, capacity);
  const extraGuestsCount = extraGuests.enabled ? Math.max(0, travelers - extraGuests.threshold) : 0;
  const extraGuestsTotal = extraGuestsCount * extraGuests.price * nights;

  return Math.max(0, Math.round(nightlyTotal + feesTotal + extraGuestsTotal));
}
