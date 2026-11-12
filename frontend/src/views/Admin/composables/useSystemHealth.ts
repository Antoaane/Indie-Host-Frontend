// File: src/views/Admin/composables/useSystemHealth.ts

// État des services, relu toutes les 15 s tant qu'un écran qui l'affiche est ouvert et que l'onglet
// du navigateur est visible. L'API mesure elle-même chaque service à son rythme : la page ne fait
// que relire le dernier état, sans charge pour les services.

import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

import type { SystemHealth } from '@/domain/api/admin'
import type { AdminDataSource } from '@/views/Admin/adminDataSource'

export function useSystemHealth(source: AdminDataSource, isActive: Ref<boolean>) {
  const health = ref<SystemHealth | null>(null)
  const error = ref<string | null>(null)
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const refreshNotice = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null

  function clearTimer() {
    if (timer) clearTimeout(timer)
    timer = null
  }

  function isPageVisible() {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden'
  }

  function load(): Promise<void> {
    if (inFlight) return inFlight
    isLoading.value = true
    inFlight = source.loadHealth()
      .then((snapshot) => {
        health.value = snapshot
        error.value = null
      })
      .catch((err: unknown) => {
        error.value = err instanceof Error ? err.message : 'Impossible de lire l’état des services.'
      })
      .finally(() => {
        isLoading.value = false
        inFlight = null
      })
    return inFlight
  }

  function schedule() {
    clearTimer()
    if (!isActive.value || !isPageVisible()) return
    timer = setTimeout(async () => {
      await load()
      schedule()
    }, source.healthPollMs)
  }

  /** Relance toutes les mesures côté serveur (au plus une fois toutes les 15 s). */
  async function refreshNow() {
    if (isRefreshing.value) return
    isRefreshing.value = true
    refreshNotice.value = null
    try {
      const { refreshed, snapshot } = await source.refreshHealth()
      health.value = snapshot
      error.value = null
      if (!refreshed) refreshNotice.value = 'Contrôles relancés il y a moins de 15 s : voici leur résultat.'
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Impossible de relancer les contrôles.'
    } finally {
      isRefreshing.value = false
      schedule()
    }
  }

  function handleVisibility() {
    if (!isActive.value) return
    if (isPageVisible()) {
      void load().then(schedule)
    } else {
      clearTimer()
    }
  }

  watch(isActive, (active) => {
    if (active) {
      void load().then(schedule)
    } else {
      clearTimer()
    }
  }, { immediate: true })

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibility)

  onBeforeUnmount(() => {
    clearTimer()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility)
  })

  return { health, error, isLoading, isRefreshing, refreshNotice, load, refreshNow }
}
