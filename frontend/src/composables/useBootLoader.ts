// File: src/composables/useBootLoader.ts

import { readonly, ref } from 'vue'
import type { Router } from 'vue-router'

// Écran de chargement du tableau de bord. Sans lui, un écran se monte par morceaux : barre
// publique et pied de page le temps que Clerk réponde, puis la coque vide, les cartes, enfin la
// colonne de gauche. Il couvre tout cela et se retire une seule fois, quand la route est résolue
// et que l'API se tait : l'écran apparaît d'un bloc.
//
// Deux déclencheurs :
// - le chargement de la page sous /dashboard (posé dès le <head> par `index.html`) ;
// - le passage d'un écran du tableau de bord à un autre (clic sur le logo, sur un onglet…), où
//   les blocs arrivaient aussi l'un après l'autre.
// En développement, les routes d'essai (/dev/editor, /dev/management…) comptent comme des écrans
// du tableau de bord : elles permettent de vérifier le passage d'un écran à l'autre sans session.
const DASHBOARD_PATH = import.meta.env.DEV ? /^\/(dashboard|dev)(\/|$)/ : /^\/dashboard(\/|$)/
// Silence réseau exigé : les requêtes enchaînées (annonces puis annonce sélectionnée)
// partent bien avant ce délai.
const QUIET_MS = 220
// Tant qu'aucune requête n'est partie, la vue attend encore quelque chose (jeton Clerk) :
// le silence ne prouve rien, on laisse plus de marge.
const FIRST_REQUEST_GRACE_MS = 600
// Plafond absolu : l'écran ne bloque jamais l'accès plus longtemps.
const MAX_WAIT_MS = 5000
// Changement d'écran : la session est déjà là et les données souvent en cache, on attend moins.
const NAVIGATION_FIRST_REQUEST_GRACE_MS = 300
const NAVIGATION_MAX_WAIT_MS = 3000
// Durée de la classe de révélation, un peu plus longue que la transition du contenu.
const REVEAL_CLASS_MS = 600

const isActive = ref(typeof window !== 'undefined' && DASHBOARD_PATH.test(window.location.pathname))

let started = false
let pendingRequests = 0
let hasSeenRequest = false
let isRouteReady = false
let firstRequestGraceMs = FIRST_REQUEST_GRACE_MS
// Vrai quand l'écran couvre un changement d'écran : la route résolue suffit alors à le libérer.
// Au chargement de la page, il attend aussi Clerk et les polices (`startBootLoader`).
let isNavigationRun = false
let quietTimer: number | null = null
let maxWaitTimer: number | null = null
let contentObserver: MutationObserver | null = null

function clearQuietTimer() {
  if (quietTimer === null) return
  window.clearTimeout(quietTimer)
  quietTimer = null
}

function scheduleRelease() {
  clearQuietTimer()
  if (!isActive.value || !isRouteReady || pendingRequests > 0) return
  quietTimer = window.setTimeout(releaseBootLoader, hasSeenRequest ? QUIET_MS : firstRequestGraceMs)
}

// Tant que l'écran se construit (une colonne qui arrive après l'autre, un composant chargé à la
// demande), le silence du réseau ne suffit pas : chaque ajout dans la page repousse la révélation.
// Seuls les ajouts et retraits d'éléments comptent, pas les changements de classe ou de style.
function watchContent() {
  if (contentObserver || typeof MutationObserver === 'undefined') return
  const content = document.querySelector('#app > main')
  if (!content) return

  contentObserver = new MutationObserver(() => {
    if (quietTimer !== null) scheduleRelease()
  })
  contentObserver.observe(content, { childList: true, subtree: true })
}

function stopWatchingContent() {
  contentObserver?.disconnect()
  contentObserver = null
}

function releaseBootLoader() {
  if (!isActive.value) return
  isActive.value = false

  stopWatchingContent()
  clearQuietTimer()
  if (maxWaitTimer !== null) window.clearTimeout(maxWaitTimer)
  maxWaitTimer = null

  // La classe de révélation porte la transition : elle doit être posée avant le retrait
  // de `is-booting` pour que le contenu glisse au lieu d'apparaître d'un coup.
  const root = document.documentElement
  root.classList.add('is-boot-revealing')
  root.classList.remove('is-booting')
  window.setTimeout(() => root.classList.remove('is-boot-revealing'), REVEAL_CLASS_MS)
}

// Réarme l'écran pour un changement d'écran. Sans effet s'il est déjà affiché.
function armForNavigation() {
  if (isActive.value) return

  hasSeenRequest = false
  isRouteReady = false
  isNavigationRun = true
  firstRequestGraceMs = NAVIGATION_FIRST_REQUEST_GRACE_MS
  isActive.value = true

  const root = document.documentElement
  root.classList.remove('is-boot-revealing')
  root.classList.add('is-booting')

  watchContent()
  if (maxWaitTimer !== null) window.clearTimeout(maxWaitTimer)
  maxWaitTimer = window.setTimeout(releaseBootLoader, NAVIGATION_MAX_WAIT_MS)
}

// Compte les requêtes en cours, pour toute la durée de la visite : l'écran peut être réarmé.
async function watchApiRequests() {
  const { default: axios } = await import('axios')

  const settle = () => {
    pendingRequests = Math.max(0, pendingRequests - 1)
    scheduleRelease()
  }

  axios.interceptors.request.use((config) => {
    pendingRequests += 1
    hasSeenRequest = true
    clearQuietTimer()
    return config
  })
  axios.interceptors.response.use(
    (response) => {
      settle()
      return response
    },
    (error: unknown) => {
      settle()
      return Promise.reject(error)
    },
  )
}

function watchDashboardNavigation(router: Router) {
  router.beforeEach((to, from) => {
    // Premier affichage : géré par `startBootLoader`. Même écran (autre annonce, autre
    // réservation) : rien à couvrir, la vue se met à jour sur place.
    if (!from.matched.length || to.name === from.name) return
    if (!DASHBOARD_PATH.test(to.path)) return
    armForNavigation()
  })

  router.afterEach((to) => {
    if (!isActive.value || !isNavigationRun) return
    // Redirection hors du tableau de bord (connexion…) : rien à attendre.
    if (!DASHBOARD_PATH.test(to.path)) {
      releaseBootLoader()
      return
    }
    isRouteReady = true
    scheduleRelease()
  })

  router.onError(releaseBootLoader)
}

// `whenAuthReady` : session Clerk chargée. Une URL avec userId passe la garde du routeur
// sans attendre Clerk, alors que les vues attendent leur jeton pour appeler l'API.
export function startBootLoader(router: Router, whenAuthReady: Promise<unknown>) {
  if (started) return
  started = true

  void watchApiRequests()
  watchDashboardNavigation(router)

  // Page chargée hors du tableau de bord : l'écran ne servira qu'aux changements d'écran.
  if (!isActive.value) return

  document.documentElement.classList.add('is-booting')
  maxWaitTimer = window.setTimeout(releaseBootLoader, MAX_WAIT_MS)

  void Promise.all([router.isReady(), whenAuthReady, document.fonts?.ready])
    .then(() => {
      // Redirection hors du tableau de bord (connexion…) : rien à attendre.
      if (!DASHBOARD_PATH.test(router.currentRoute.value.path)) {
        releaseBootLoader()
        return
      }
      isRouteReady = true
      watchContent()
      scheduleRelease()
    })
    .catch(releaseBootLoader)
}

export function useBootLoader() {
  return { isBootLoaderActive: readonly(isActive) }
}
