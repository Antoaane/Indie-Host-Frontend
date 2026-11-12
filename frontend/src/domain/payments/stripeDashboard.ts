// File: src/domain/payments/stripeDashboard.ts

import { createMyStripeConnectDashboardLink } from '@/domain/api/stripeSubscriptions'

// Connexion au tableau de bord Stripe complet, celui des comptes d'encaissement créés par IndieHost.
export const STRIPE_DASHBOARD_URL = 'https://dashboard.stripe.com/'

/**
 * Ouvre le tableau de bord Stripe de l'hôte dans un nouvel onglet.
 *
 * L'onglet est créé dès le clic : ouvert après l'appel réseau, le navigateur le bloque comme une
 * fenêtre surgissante. Si le lien ne peut pas être préparé, l'hôte arrive sur la page de connexion
 * de Stripe plutôt que sur un clic sans effet. Le compte est celui du profil, choisi par l'API.
 */
export async function openStripeDashboard(): Promise<void> {
  const tab = window.open('', '_blank')
  const open = (url: string) => {
    if (tab && !tab.closed) {
      tab.opener = null
      tab.location.replace(url)
      return
    }
    window.location.assign(url)
  }

  try {
    const dashboard = await createMyStripeConnectDashboardLink()
    open(dashboard.url)
  } catch (error) {
    console.warn('[stripe] lien vers le tableau de bord indisponible, ouverture de la page de connexion Stripe', { error })
    open(STRIPE_DASHBOARD_URL)
  }
}
