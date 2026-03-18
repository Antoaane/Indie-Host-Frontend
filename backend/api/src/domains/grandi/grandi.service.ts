import { env } from '../../config/env.js';

const GANDI_API_BASE = (env.GANDI_API_BASE_URL || 'https://api.gandi.net/v5').replace(/\/+$/, '');
const GANDI_CHECKOUT_BASE = (env.GANDI_CHECKOUT_BASE_URL || 'https://www.gandi.net/en/domain/checkout').replace(/\/+$/, '');

export type DomainAvailabilityResult = {
  domain: string;
  available: boolean;
  premium: boolean;
  priceCents: number | null;
  currency: string;
  reason: string | null;
};

export type DomainCheckoutSession = {
  id: string;
  checkoutUrl: string;
};

type GandiProduct = {
  name?: string;
  status?: string;
  prices?: Array<{
    price_after_taxes?: number;
    duration_unit?: string;
    min_duration?: number;
  }>;
};

type GandiCheckResponse = {
  products?: GandiProduct[];
};

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  return '';
}

function resolveAvailability(status: string): { available: boolean; premium: boolean; reason: string | null } {
  switch (status) {
    case 'available':
      return { available: true, premium: false, reason: null };
    case 'available_preorder':
      return { available: true, premium: false, reason: 'Précommande disponible.' };
    case 'available_reserved':
      return { available: true, premium: true, reason: 'Disponible sous conditions particulières.' };
    case 'unavailable_premium':
      return { available: false, premium: true, reason: 'Domaine premium non disponible à la vente standard.' };
    case 'unavailable':
      return { available: false, premium: false, reason: 'Ce domaine est déjà enregistré.' };
    case 'unavailable_restricted':
      return { available: false, premium: false, reason: 'Ce domaine est restreint.' };
    case 'pending':
      return { available: false, premium: false, reason: 'Résultat en attente, réessayez dans quelques instants.' };
    case 'error_invalid':
      return { available: false, premium: false, reason: 'Nom de domaine invalide.' };
    case 'error_timeout':
    case 'error_refused':
      return { available: false, premium: false, reason: 'Service temporairement indisponible, réessayez.' };
    default:
      return { available: false, premium: false, reason: `Statut inconnu: ${status}` };
  }
}

function extractFirstYearPrice(product: GandiProduct, currency: string): number | null {
  const prices = product.prices ?? [];

  // Prefer annual price (1y)
  const annual = prices.find(
    (p) => (p.duration_unit === 'y' || p.duration_unit === 'year') && (p.min_duration ?? 1) <= 1,
  );
  const target = annual ?? prices[0];
  if (!target) return null;

  const priceEuros = target.price_after_taxes;
  if (typeof priceEuros !== 'number' || !Number.isFinite(priceEuros)) return null;

  return Math.round(priceEuros * 100);
}

export class GrandiService {
  private readonly apiToken: string;

  constructor() {
    this.apiToken = env.GANDI_API_TOKEN ?? '';
  }

  private authHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  async checkAvailability(domain: string, currency = 'EUR'): Promise<DomainAvailabilityResult> {
    const normalized = domain.trim().toLowerCase();

    if (!this.apiToken) {
      return {
        domain: normalized,
        available: false,
        premium: false,
        priceCents: null,
        currency,
        reason: 'Token API Gandi non configuré.',
      };
    }

    const params = new URLSearchParams({
      name: normalized,
      processes: 'create',
      currency: currency.toUpperCase(),
    });

    const url = `${GANDI_API_BASE}/domain/check?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Gandi API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as GandiCheckResponse;
    const products: GandiProduct[] = data.products ?? [];

    // Gandi returns one product entry per queried domain (may return several when no extension given)
    const product = products.find((p) => {
      const name = toStringValue(p.name).toLowerCase();
      return name === normalized || name.startsWith(normalized.split('.')[0] ?? '');
    }) ?? products[0];

    if (!product) {
      return {
        domain: normalized,
        available: false,
        premium: false,
        priceCents: null,
        currency,
        reason: 'Aucune information disponible pour ce domaine.',
      };
    }

    const status = toStringValue(product.status);
    const { available, premium, reason } = resolveAvailability(status);
    const priceCents = available ? extractFirstYearPrice(product, currency) : null;

    return {
      domain: toStringValue(product.name) || normalized,
      available,
      premium,
      priceCents,
      currency,
      reason,
    };
  }

  async createCheckoutSession(
    domain: string,
    options?: { userId?: string; customerEmail?: string; successUrl?: string; cancelUrl?: string },
  ): Promise<DomainCheckoutSession> {
    const normalized = domain.trim().toLowerCase();

    // Gandi ne propose pas d'API de session de paiement hébergée.
    // On génère une URL directe vers leur interface d'achat en ligne.
    const checkoutUrl = `${GANDI_CHECKOUT_BASE}?domain=${encodeURIComponent(normalized)}`;

    const sessionId = `gandi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      id: sessionId,
      checkoutUrl,
    };
  }
}
