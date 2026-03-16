<!-- File: src/views/CreateListing/components/panels/CreateImportStepPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'

import { ensurePublishedMediasStoredInImageKit } from '@/domain/api/imagekit'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import {
  detectListingSource,
  normalizeListingUrl,
  scrapeListing,
  transformAirbnbToRawListingBundle,
  transformBookingToRawListingBundle,
} from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel'
import type { AirbnbScrapedData, BookingScrapedData } from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'
import { LANDING_IMPORT_URL_KEY } from '@/views/Landing/components/IntroSection/landingImportUrlKey'

const props = defineProps<{
  listingId?: string | null
  listingStatus?: string | null
  importUrl?: string
  importRequestToken?: number
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
  (e: 'next'): void
  (e: 'update:importUrl', value: string): void
}>()

const url = ref(props.importUrl ?? '')

watch(
  () => props.importUrl,
  (value) => {
    const nextValue = value ?? ''
    if (nextValue !== url.value) {
      url.value = nextValue
    }
  },
)

watch(url, (value) => {
  emit('update:importUrl', value)
})

onMounted(() => {
  try {
    const stored = sessionStorage.getItem(LANDING_IMPORT_URL_KEY)
    if (stored?.trim() && !url.value.trim()) {
      url.value = stored.trim()
      sessionStorage.removeItem(LANDING_IMPORT_URL_KEY)
    }
  } catch {
    // ignore
  }
})
const isImporting = ref(false)
const importError = ref<string | null>(null)
const panelContent = editorStatic.panels.listing.import

const detectedSource = computed(() => detectListingSource(url.value))
const placeholder = computed(() =>
  detectedSource.value === 'booking'
    ? panelContent.bookingPlaceholder
    : panelContent.airbnbPlaceholder,
)
const canImport = computed(
  () =>
    url.value.trim().length > 0 &&
    (detectedSource.value === 'airbnb' || detectedSource.value === 'booking') &&
    !isImporting.value,
)

watch(
  () => props.importRequestToken,
  (value, previousValue) => {
    if (value == null || value === previousValue) return
    handleImport()
  },
)

async function handleImport() {
  if (!canImport.value) return
  importError.value = null
  isImporting.value = true
  try {
    const normalizedUrl = normalizeListingUrl(url.value.trim())
    const source = detectListingSource(normalizedUrl)
    if (source !== 'airbnb' && source !== 'booking') {
      importError.value =
        "Lien non reconnu. Utilisez un lien Airbnb (https://www.airbnb.fr/rooms/…) ou Booking (https://www.booking.com/hotel/…)"
      return
    }

    const data = await scrapeListing({ url: normalizedUrl })
    const transformed =
      source === 'airbnb'
        ? transformAirbnbToRawListingBundle(data as AirbnbScrapedData)
        : transformBookingToRawListingBundle(data as BookingScrapedData)
    const medias = await ensurePublishedMediasStoredInImageKit(transformed.medias, {
      listingId: props.listingId,
      listingStatus: props.listingStatus,
    })
    const patch: DraftPatch = {
      ...(transformed.core ? { core: transformed.core } : {}),
      ...(transformed.bookings ? { bookings: transformed.bookings } : {}),
      ...(medias ? { medias } : {}),
      ...(transformed.arrival ? { arrival: transformed.arrival } : {}),
      ...(transformed.notes ? { notes: transformed.notes } : {}),
    }
    emit('patch', patch)
    emit('next')
    importError.value = null
  } catch (err) {
    importError.value =
      err instanceof Error ? err.message : 'Impossible de récupérer l\'annonce.'
  } finally {
    isImporting.value = false
  }
}

function handleCreateManually() {
  // Pas d'import, on passe simplement à l'étape suivante
  importError.value = null
  emit('next')
}
</script>

<template>
  <CreateWizardStepShell
    :title="panelContent.title"
    :hint="panelContent.subtitle"
    :validation-error="importError"
  >
    <div class="create-import-step-panel">
      <div class="row input-row">
        <div class="input action">
          <input
            v-model="url"
            :placeholder="placeholder"
            type="url"
            :disabled="isImporting"
            @keydown.enter.prevent="handleImport"
          />
          <div class="action">
            <button
              type="button"
              :disabled="!canImport"
              @click="handleImport"
            >
              <Loader2
                v-if="isImporting"
                class="icon is-spinning"
                :aria-label="panelContent.importLoading"
                :title="panelContent.importLoading"
              />
              <Download
                v-else
                class="icon"
                :aria-label="panelContent.cta"
                :title="panelContent.cta"
              />
              <span>{{ panelContent.cta }}</span>
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="create-manually"
        @click="handleCreateManually"
      >
        {{ panelContent.createManually }}
        <slot name="hint" />
      </button>
    </div>
  </CreateWizardStepShell>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;

.create-import-step-panel {
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-sm);

  > .input-row {
    > .input {
      @include inputs.action($theme: base, $action-theme: white);

      > .action {
        > * {
          width: auto;
          min-width: 7.5rem;
          height: 42px;
          padding: 0 0.9rem;

          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;

          border-radius: borders.$rounded-sm;
          white-space: nowrap;
        }

        .icon {
          width: 1rem;
          height: 1rem;
          flex: 0 0 auto;
        }

        span {
          line-height: 1;
        }
      }
    }
  }

  > .create-manually {
    margin: var(--layout-gap-sm) 0 0 0;
    @include little-text($thin: false);
    color: rgba($secondary-text, 0.65);
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    text-decoration: underline;
  }
}

.is-spinning {
  animation: create-import-spin 0.9s linear infinite;
}

@keyframes create-import-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
