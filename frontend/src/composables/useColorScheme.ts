// File: src/composables/useColorScheme.ts

// Thème clair ou sombre du tableau de bord.
//
// - Par défaut le thème suit le système (`prefers-color-scheme`) et change avec lui, sans recharger.
// - L'hôte peut le forcer depuis « Mon profil » → Apparence ; son choix est gardé dans le navigateur.
// - Le thème sombre ne s'applique qu'aux écrans du tableau de bord (routes `navVariant: 'host'`) :
//   la landing, les annonces publiques et les pages légales restent claires.
//
// Le thème est porté par `data-theme` sur <html> ; les couleurs suivent par les variables CSS de
// `styles/layouts/_theme.scss`. La classe `dark` est posée pour les composants @nuxt/ui.

import { computed, ref, watch, type ComputedRef } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

import { useThemeStore } from '@/stores/theme'

export type ColorSchemePreference = 'auto' | 'light' | 'dark'
export type ColorScheme = 'light' | 'dark'

const STORAGE_KEY = 'indiehost:color-scheme'
const SYSTEM_QUERY = '(prefers-color-scheme: dark)'

function readStoredPreference(): ColorSchemePreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

const hasWindow = typeof window !== 'undefined'
const systemQuery = hasWindow && typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_QUERY) : null

// État partagé par toute l'application : un seul thème à la fois.
const preference = ref<ColorSchemePreference>(hasWindow ? readStoredPreference() : 'auto')
const systemPrefersDark = ref(Boolean(systemQuery?.matches))
const isDashboard = ref(false)

systemQuery?.addEventListener('change', (event) => {
  systemPrefersDark.value = event.matches
})

/** Thème réellement affiché. */
const scheme: ComputedRef<ColorScheme> = computed(() => {
  if (!isDashboard.value) return 'light'
  if (preference.value === 'auto') return systemPrefersDark.value ? 'dark' : 'light'
  return preference.value
})

function applyScheme(value: ColorScheme) {
  if (!hasWindow) return
  const root = document.documentElement
  root.dataset.theme = value
  root.classList.toggle('dark', value === 'dark')
}

export function setColorSchemePreference(value: ColorSchemePreference) {
  preference.value = value
  try {
    if (value === 'auto') window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour cette visite.
  }
}

/** Réglage « Apparence » : choix de l'hôte et thème affiché. */
export function useColorScheme() {
  return {
    preference: computed(() => preference.value),
    scheme,
    systemScheme: computed<ColorScheme>(() => (systemPrefersDark.value ? 'dark' : 'light')),
    setPreference: setColorSchemePreference,
  }
}

/**
 * À appeler une fois, à la racine de l'application : suit la route, le système et le choix de
 * l'hôte, et pose le thème sur le document. Les logos (`components/svgs/factory.ts`) lisent le
 * magasin `theme`, tenu à jour ici.
 */
export function installColorScheme(route: RouteLocationNormalizedLoaded) {
  const themeStore = useThemeStore()

  watch(
    () => route.meta.navVariant,
    (navVariant) => {
      isDashboard.value = navVariant === 'host'
    },
    { immediate: true },
  )

  watch(
    scheme,
    (value) => {
      applyScheme(value)
      themeStore.current = value
    },
    { immediate: true },
  )
}
