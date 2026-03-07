import { ref } from 'vue'
import { LANDING_IMPORT_URL_KEY } from '@/views/Landing/components/IntroSection/landingImportUrlKey'

const pendingUrl = ref<string>('')

export function useLandingImport() {
  function submitUrl(rawUrl: string) {
    const trimmed = rawUrl.trim()
    pendingUrl.value = trimmed
    if (trimmed) {
      try {
        sessionStorage.setItem(LANDING_IMPORT_URL_KEY, trimmed)
      } catch {
        // ignore
      }
    }
  }

  return { pendingUrl, submitUrl }
}
