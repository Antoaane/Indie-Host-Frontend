import type Stripe from 'stripe';

/**
 * Vrai quand l'hôte a fourni tout ce que Stripe demandait et que Stripe vérifie ses pièces : le
 * compte n'encaisse pas encore, mais il n'y a rien à faire de son côté.
 *
 * Stripe le signale par `requirements.disabled_reason` (`requirements.pending_verification`, ou
 * `under_review` pour un examen plus long) alors que `currently_due` et `past_due` sont vides.
 * Tant que cet état n'était pas distingué, la page d'activation affichait « Stripe Connect reste
 * incomplet » et proposait de recommencer l'inscription.
 */
export function isStripeAccountUnderReview(account: Pick<Stripe.Account, 'details_submitted' | 'requirements'>): boolean {
  const requirements = account.requirements;
  if (!account.details_submitted || !requirements) return false;

  // Une pièce à fournir ou refusée : c'est à l'hôte d'agir.
  if ((requirements.currently_due?.length ?? 0) > 0) return false;
  if ((requirements.past_due?.length ?? 0) > 0) return false;
  if ((requirements.errors?.length ?? 0) > 0) return false;

  const disabledReason = requirements.disabled_reason ?? null;
  if (disabledReason) {
    return disabledReason === 'requirements.pending_verification' || disabledReason === 'under_review';
  }

  return (requirements.pending_verification?.length ?? 0) > 0;
}
