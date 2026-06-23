<!-- File: src/views/CreateListing/components/panels/CreateImportStepPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowRight, Download, Loader2, PenLine } from 'lucide-vue-next'
import AirbnbLogo from '@/components/svgs/icons/AirbnbLogo.vue'
import BookingLogo from '@/components/svgs/icons/BookingLogo.vue'

import ImportLoadingState from '@/components/feedback/ImportLoadingState.vue'
import { ensurePublishedMediasStoredInImageKit } from '@/domain/api/imagekit'
import { useImportLoadingFeedback } from '@/composables/useImportLoadingFeedback'
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
const {
  progressPercent,
  progressLabel,
  progressTitle,
  progressHint,
  progressTip,
  startImportLoadingFeedback,
  completeImportLoadingFeedback,
  resetImportLoadingFeedback,
} = useImportLoadingFeedback()

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
  try {
    const normalizedUrl = normalizeListingUrl(url.value.trim())
    const source = detectListingSource(normalizedUrl)
    if (source !== 'airbnb' && source !== 'booking') {
      importError.value =
        "Lien non reconnu. Utilisez un lien Airbnb (https://www.airbnb.fr/rooms/…) ou Booking (https://www.booking.com/hotel/…)"
      return
    }

    startImportLoadingFeedback(source)
    isImporting.value = true
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
    await completeImportLoadingFeedback()
    emit('patch', patch)
    emit('next')
    importError.value = null
  } catch (err) {
    importError.value =
      err instanceof Error ? err.message : 'Impossible de récupérer l\'annonce.'
  } finally {
    isImporting.value = false
    resetImportLoadingFeedback()
  }
}

function handleCreateManually() {
  importError.value = null
  emit('next')
}
</script>

<template>
  <CreateWizardStepShell
    :title="panelContent.title"
    :validation-error="importError"
    centered
  >
    <div class="create-import-step-panel">

      <!-- Card : importer -->
      <div class="path-card import-card">
        <div class="card-header">
          <div class="card-icon import-icon">
            <Download :size="16" />
          </div>
          <div class="card-text">
            <strong>{{ panelContent.importCardTitle }}</strong>
            <p>{{ panelContent.importCardDescription }}</p>
          </div>
        </div>

        <div class="platform-logos">
          <AirbnbLogo />
          <BookingLogo />
        </div>

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

        <ImportLoadingState
          v-if="isImporting"
          :label="progressLabel"
          :progress="progressPercent"
          :title="progressTitle"
          :hint="progressHint"
          :tip="progressTip"
        />
      </div>

      <!-- Séparateur -->
      <div class="paths-divider">
        <span>{{ panelContent.divider }}</span>
      </div>

      <!-- Card : créer manuellement -->
      <div class="path-card manual-card">
        <div class="card-header">
          <div class="card-icon manual-icon">
            <PenLine :size="16" />
          </div>
          <div class="card-text">
            <strong>{{ panelContent.manualCardTitle }}</strong>
            <p>{{ panelContent.manualCardDescription }}</p>
          </div>
        </div>

        <button
          type="button"
          class="manual-cta"
          @click="handleCreateManually"
        >
          {{ panelContent.manualCta }}
          <ArrowRight :size="14" />
        </button>
      </div>

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
  gap: 0.75rem;

  .path-card {
    border-radius: borders.$rounded-md;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;

    &.import-card {
      border: 1px solid rgba($primary_gradiant_first, 0.2);
      background: rgba($primary_gradiant_first, 0.035);
    }

    &.manual-card {
      border: 1px solid rgba($secondary, 0.08);
      background: transparent;
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;

      .card-icon {
        width: 2rem;
        height: 2rem;
        border-radius: borders.$rounded-sm;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.import-icon {
          background: rgba($primary_gradiant_first, 0.14);
          color: $primary_gradiant_first;
        }

        &.manual-icon {
          background: rgba($secondary, 0.07);
          color: rgba($secondary, 0.55);
        }
      }

      .card-text {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;

        strong {
          @include little-text($thin: false);
          font-weight: 700;
          color: $secondary-text;
        }

        p {
          margin: 0;
          @include little-text($thin: true);
          color: rgba($secondary-text, 0.58);
          line-height: 1.45;
        }
      }
    }

    .platform-logos {
      display: flex;
      gap: 0.4rem;

      > svg {
        width: 1.5rem;
        height: 1.5rem;
        flex: 0 0 1.5rem;
      }
    }

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

    .manual-cta {
      align-self: flex-end;
      background: transparent;
      border: 1px solid rgba($secondary, 0.18);
      border-radius: borders.$rounded;
      color: rgba($secondary-text, 0.8);
      padding: 0.5rem 1rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 200ms cubic-bezier(0.6, 0, 0.3, 1);

      &:hover:not(:disabled) {
        background: rgba($secondary, 0.05);
        border-color: rgba($secondary, 0.28);
        color: $secondary;
      }
    }
  }

  .paths-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 0.25rem;

    &::before,
    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba($secondary, 0.08);
    }

    span {
      @include little-text($thin: true);
      color: rgba($secondary-text, 0.35);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
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
