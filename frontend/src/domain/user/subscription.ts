// File: src/domain/user/subscription.ts

import type { StripeListingAllowance } from '@/domain/api/stripeSubscriptions'

// Valeur de secours tant que l'état d'abonnement n'est pas chargé : logements inclus dans le plan IndieHost.
const DEFAULT_MAX_ACTIVE_LISTINGS = 2

/**
 * Nombre maximal de logements en ligne (publiés, en pause ou gelés) pour l'utilisateur :
 * logements inclus dans le plan + logements supplémentaires achetés, calculés côté serveur.
 */
export function getUserMaxActiveListings(allowance?: StripeListingAllowance | null): number {
  if (allowance && typeof allowance.maxActiveListings === 'number' && Number.isFinite(allowance.maxActiveListings)) {
    return Math.max(0, Math.trunc(allowance.maxActiveListings))
  }
  return DEFAULT_MAX_ACTIVE_LISTINGS
}
