// Catalogue des plans IndieHost : valeurs de secours et règles partagées entre
// le domaine payments (Stripe) et le domaine listings (limite de logements).
// La source de vérité des prix et des logements inclus reste le catalogue Stripe
// (métadonnées `indiehost_plan_code` / `indiehost_max_active_listings`).

export type SubscriptionPlanCode = 'indiehost' | 'superhost';

export type SubscriptionAddonCode = 'extra_listing';

export type PlanTemplate = {
  name: string;
  description: string;
  maxActiveListings: number;
  defaultCurrency: string;
  defaultMonthlyPriceMinor: number;
};

export const PLAN_CODES: SubscriptionPlanCode[] = [
  'indiehost',
  'superhost',
];

export const PLAN_TEMPLATES: Record<SubscriptionPlanCode, PlanTemplate> = {
  indiehost: {
    name: 'IndieHost',
    description: 'L’offre essentielle pour mettre en ligne jusqu’à 2 logements, sans commission.',
    maxActiveListings: 2,
    defaultCurrency: 'eur',
    defaultMonthlyPriceMinor: 1900,
  },
  superhost: {
    name: 'SuperHost',
    description: 'Pour les hôtes qui gèrent jusqu’à 6 logements avec leur propre nom de domaine.',
    maxActiveListings: 6,
    defaultCurrency: 'eur',
    defaultMonthlyPriceMinor: 4900,
  },
};

export const EXTRA_LISTING_TEMPLATE = {
  code: 'extra_listing' as const,
  name: 'Logement supplémentaire',
  description: 'Un logement en ligne de plus que ceux inclus dans votre plan, facturé par mois.',
  defaultCurrency: 'eur',
  defaultMonthlyPriceMinor: 1200,
};

export const EXTRA_LISTINGS_MAX = 50;

// Statuts qui consomment un « logement en gestion » : tout ce qui a été mis en ligne.
// Les brouillons sont libres, les annonces supprimées ne comptent plus.
export const LISTING_LIMIT_COUNTED_STATUSES = ['published', 'paused', 'blocked'] as const;

export function normalizePlanCode(value: unknown): SubscriptionPlanCode | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  if (raw === 'indiehost' || raw === 'superhost') return raw;
  return null;
}

export function normalizeAddonCode(value: unknown): SubscriptionAddonCode | null {
  if (typeof value !== 'string') return null;
  return value.trim().toLowerCase() === 'extra_listing' ? 'extra_listing' : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

export function readExtraListingsFromBilling(billing: Record<string, unknown>): number {
  return readNonNegativeInteger(billing.extraListings) ?? 0;
}

/**
 * Logements inclus dans le plan courant : la valeur figée lors de la dernière synchro Stripe
 * (`includedListings`, qui reflète les métadonnées produit) sinon la valeur de secours du plan.
 */
export function resolveIncludedListingsFromBilling(billing: Record<string, unknown>): number {
  const stored = readNonNegativeInteger(billing.includedListings);
  if (stored !== null) return stored;

  const planCode = normalizePlanCode(billing.planCode);
  return planCode ? PLAN_TEMPLATES[planCode].maxActiveListings : 0;
}

export function resolveMaxActiveListingsFromBilling(billing: Record<string, unknown>): number {
  return resolveIncludedListingsFromBilling(billing) + readExtraListingsFromBilling(billing);
}
