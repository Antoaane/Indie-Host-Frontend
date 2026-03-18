<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel/ImportPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Loader2 } from 'lucide-vue-next'

import ImportLoadingState from '@/components/feedback/ImportLoadingState.vue'
import { ensurePublishedMediasStoredInImageKit } from '@/domain/api/imagekit'
import { useImportLoadingFeedback } from '@/composables/useImportLoadingFeedback'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

import {
  detectListingSource,
  normalizeListingUrl,
  scrapeListing,
  transformAirbnbToRawListingBundle,
  transformBookingToRawListingBundle,
} from './index'
import type { AirbnbScrapedData, BookingScrapedData } from './index'

const props = defineProps<{
  listingId?: string | null
  listingStatus?: string | null
}>()

const url = ref('')
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

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

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
const importButtonA11yLabel = computed(() =>
  isImporting.value ? panelContent.importLoadingA11y : panelContent.ctaA11y,
)

async function handleImport() {
  if (isImporting.value) return
  importError.value = null

  const trimmedUrl = url.value.trim()
  if (!trimmedUrl) {
    importError.value = "Collez un lien Airbnb pour importer votre annonce."
    return
  }

  const normalizedUrl = normalizeListingUrl(trimmedUrl)
  const source = detectListingSource(normalizedUrl)
  if (source !== 'airbnb' && source !== 'booking') {
    importError.value =
      "Lien non reconnu. Utilisez un lien Airbnb (https://www.airbnb.fr/rooms/…) ou Booking (https://www.booking.com/hotel/…)"
    return
  }

  startImportLoadingFeedback(source)
  isImporting.value = true
  try {
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
  } catch (err) {
    importError.value =
      err instanceof Error ? err.message : "Impossible de récupérer l'annonce."
  } finally {
    isImporting.value = false
    resetImportLoadingFeedback()
  }
}
</script>

<template>
  <section class="editor-import-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="row">
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
              :aria-label="importButtonA11yLabel"
              :title="importButtonA11yLabel"
            >
              <span class="sr-only">{{ importButtonA11yLabel }}</span>
              <Loader2
                v-if="isImporting"
                class="icon is-spinning"
                aria-hidden="true"
                focusable="false"
              />
              <Download
                v-else
                class="icon"
                aria-hidden="true"
                focusable="false"
              />
            </button>
          </div>
        </div>
      </div>

      <ImportLoadingState
        v-if="isImporting"
        :label="progressLabel"
        :progress="progressPercent"
        :title="progressTitle"
        :hint="progressHint"
        :tip="progressTip"
        compact
      />

      <p
        v-if="importError"
        class="meta is-error"
      >
        {{ importError }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/import-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-import-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .row {
      > .input {
        @include inputs.action($theme: base, $action-theme: white);
      }
    }

    > .meta {
      margin: var(--layout-gap-xs) 0 0 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.7);

      &.is-error {
        color: rgba($bad, 0.95);
      }
    }
  }
}

.is-spinning {
  animation: editor-import-spin 0.9s linear infinite;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes editor-import-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
