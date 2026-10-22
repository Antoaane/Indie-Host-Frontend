// File: src/composables/useBootLoader.ts

import { readonly, ref } from 'vue'
import type { Router } from 'vue-router'

// Écran de chargement d'un tableau de bord rechargé. Sans lui, la page se monte par
// morceaux : barre publique et pied de page le temps que Clerk réponde, puis la coque
// vide, les cartes, enfin la barre latérale. Il couvre tout cela et se retire une seule
// fois, quand la route est résolue et que l'API se tait.
const DASHBOARD_PATH = /^\/dashboard(\/|$)/
// Silence réseau exigé : les requêtes enchaînées (annonces puis annonce sélectionnée)
// partent bien avant ce délai.
const QUIET_MS = 220
// Tant qu'aucune requête n'est partie, la vue attend encore quelque chose (jeton Clerk) :
// le silence ne prouve rien, on laisse plus de marge.
const FIRST_REQUEST_GRACE_MS = 600
// Plafond absolu : l'écran ne bloque jamais l'accès plus longtemps.
const MAX_WAIT_MS = 5000
// Durée de la classe de révélation, un peu plus longue que la transition du contenu.
const REVEAL_CLASS_MS = 600

const isActive = ref(typeof window !== 'undefined' && DASHBOARD_PATH.test(window.location.pathname))

let started = false
let pendingRequests = 0
let hasSeenRequest = false
let isRouteReady = false
let quietTimer: number | null = null
let maxWaitTimer: number | null = null
let detachInterceptors: (() => void) | null = null

function clearQuietTimer() {
  if (quietTimer === null) return
  window.clearTimeout(quietTimer)
  quietTimer = null
}

function scheduleRelease() {
  clearQuietTimer()
  if (!isActive.value || !isRouteReady || pendingRequests > 0) return
  quietTimer = window.setTimeout(releaseBootLoader, hasSeenRequest ? QUIET_MS : FIRST_REQUEST_GRACE_MS)
}

function releaseBootLoader() {
  if (!isActive.value) return
  isActive.value = false

  clearQuietTimer()
  if (maxWaitTimer !== null) window.clearTimeout(maxWaitTimer)
  maxWaitTimer = null
  detachInterceptors?.()
  detachInterceptors = null

  // La classe de révélation porte la transition : elle doit être posée avant le retrait
  // de `is-booting` pour que le contenu glisse au lieu d'apparaître d'un coup.
  const root = document.documentElement
  root.classList.add('is-boot-revealing')
  root.classList.remove('is-booting')
  window.setTimeout(() => root.classList.remove('is-boot-revealing'), REVEAL_CLASS_MS)
}

async function watchApiRequests() {
  const { default: axios } = await import('axios')
  if (!isActive.value) return

  const settle = () => {
    pendingRequests = Math.max(0, pendingRequests - 1)
    scheduleRelease()
  }

  const requestId = axios.interceptors.request.use((config) => {
    pendingRequests += 1
    hasSeenRequest = true
    clearQuietTimer()
    return config
  })
  const responseId = axios.interceptors.response.use(
    (response) => {
      settle()
      return response
    },
    (error: unknown) => {
      settle()
      return Promise.reject(error)
    },
  )

  detachInterceptors = () => {
    axios.interceptors.request.eject(requestId)
    axios.interceptors.response.eject(responseId)
  }
}

// `whenAuthReady` : session Clerk chargée. Une URL avec userId passe la garde du routeur
// sans attendre Clerk, alors que les vues attendent leur jeton pour appeler l'API.
export function startBootLoader(router: Router, whenAuthReady: Promise<unknown>) {
  if (started || !isActive.value) return
  started = true

  document.documentElement.classList.add('is-booting')
  maxWaitTimer = window.setTimeout(releaseBootLoader, MAX_WAIT_MS)
  void watchApiRequests()

  void Promise.all([router.isReady(), whenAuthReady, document.fonts?.ready])
    .then(() => {
      // Redirection hors du tableau de bord (connexion…) : rien à attendre.
      if (!DASHBOARD_PATH.test(router.currentRoute.value.path)) {
        releaseBootLoader()
        return
      }
      isRouteReady = true
      scheduleRelease()
    })
    .catch(releaseBootLoader)
}

export function useBootLoader() {
  return { isBootLoaderActive: readonly(isActive) }
}
