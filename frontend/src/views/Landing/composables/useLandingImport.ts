// File: src/views/Landing/composables/useLandingImport.ts

import { ref } from 'vue'
import { LANDING_IMPORT_URL_KEY } from '@/views/Landing/components/IntroSection/landingImportUrlKey'

const pendingUrl = ref<string>('')
const pendingRequestId = ref(0)

export function useLandingImport() {
  function submitUrl(rawUrl: string) {
    const trimmed = rawUrl.trim()
    pendingUrl.value = trimmed
    pendingRequestId.value += 1
    if (trimmed) {
      try {
        sessionStorage.setItem(LANDING_IMPORT_URL_KEY, trimmed)
      } catch {
        // ignore
      }
    }
  }

  return { pendingUrl, pendingRequestId, submitUrl }
}
