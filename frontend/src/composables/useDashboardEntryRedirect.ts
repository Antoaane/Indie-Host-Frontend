// File: src/composables/useDashboardEntryRedirect.ts

import { useSession } from '@clerk/vue'
import { watch } from 'vue'
import { useRouter } from 'vue-router'

import { DASHBOARD_ENTRY_PATH } from '@/utils/authEntry'

/**
 * Sur la landing, en secours de la garde du routeur (cookie de Clerk absent, ou Clerk plus lent
 * que l'attente de la garde) : un hôte connecté qui ouvre indiehost.fr part sur ses annonces dès
 * que Clerk confirme la session.
 *
 * Seulement si la landing est la page d'entrée de l'onglet : un lien interne vers la landing
 * (pied de page d'une page légale…) l'affiche toujours.
 */
export function useDashboardEntryRedirect() {
  if (typeof window === 'undefined') return

  const router = useRouter()
  const { isLoaded, session } = useSession()

  // vue-router mémorise la page précédente dans `history.state.back` : vide à l'ouverture
  // directe d'une URL (adresse tapée, lien d'e-mail, retour de Clerk), renseignée après une
  // navigation interne.
  const historyState = window.history.state as { back?: unknown } | null
  const isDirectEntry = !(historyState && typeof historyState.back === 'string' && historyState.back)
  if (!isDirectEntry) return

  // `let` et non `const` : avec `immediate`, le rappel peut s'exécuter avant que `watch` ait rendu
  // sa fonction d'arrêt (Clerk déjà chargé).
  let settled = false
  let stop: (() => void) | undefined
  stop = watch(
    [isLoaded, session],
    ([loaded, currentSession]) => {
      if (settled || !loaded) return
      settled = true
      stop?.()
      if (currentSession?.id) void router.replace(DASHBOARD_ENTRY_PATH)
    },
    { immediate: true },
  )
  if (settled) stop()
}
