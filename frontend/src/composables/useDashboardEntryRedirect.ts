// File: src/composables/useDashboardEntryRedirect.ts

import { useSession } from '@clerk/vue'
import { watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  DASHBOARD_ENTRY_PATH,
  arrivedWithClerkParams,
  markDashboardEntryHandled,
  shouldOpenDashboardOnEntry,
  wasDashboardEntryHandled,
} from '@/utils/authEntry'

/**
 * Sur la landing : un hôte qui arrive connecté par un lien à jeton (ou par l'« Impersonate »
 * de l'admin) est envoyé sur son tableau de bord. Une seule fois par session, et seulement
 * si la landing est la page d'entrée de l'onglet : revenir ensuite sur la landing reste possible.
 */
export function useDashboardEntryRedirect() {
  if (typeof window === 'undefined') return

  const router = useRouter()
  const { isLoaded, session } = useSession()

  // vue-router mémorise la page précédente dans `history.state.back` : vide à l'ouverture
  // directe d'une URL (lien d'e-mail, retour de Clerk), renseignée après une navigation interne.
  const historyState = window.history.state as { back?: unknown } | null
  const isDirectEntry = !(historyState && typeof historyState.back === 'string' && historyState.back)

  const stop = watch(
    [isLoaded, session],
    ([loaded, currentSession]) => {
      if (!loaded) return
      stop?.()

      if (!currentSession) return
      const entrySession = {
        id: currentSession.id,
        createdAt: currentSession.createdAt,
        hasActor: Boolean(currentSession.actor),
      }

      const shouldRedirect = shouldOpenDashboardOnEntry({
        isDirectEntry,
        hasClerkParams: arrivedWithClerkParams,
        session: entrySession,
        alreadyHandled: wasDashboardEntryHandled(entrySession.id),
        now: Date.now(),
      })
      if (!shouldRedirect) return

      markDashboardEntryHandled(entrySession.id)
      void router.replace(DASHBOARD_ENTRY_PATH)
    },
    { immediate: true },
  )
}
