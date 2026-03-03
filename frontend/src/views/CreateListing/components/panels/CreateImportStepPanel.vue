<!-- File: src/views/CreateListing/components/panels/CreateImportStepPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import {
  detectListingSource,
  scrapeListing,
  transformAirbnbToRawListingBundle,
} from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel'
import type { AirbnbScrapedData } from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const url = ref('')
const isImporting = ref(false)
const importError = ref<string | null>(null)
const panelContent = editorStatic.panels.listing.import

const detectedSource = computed(() => detectListingSource(url.value))
const isBooking = computed(() => detectedSource.value === 'booking')
const isAirbnb = computed(() => detectedSource.value === 'airbnb')
const canImport = computed(
  () => url.value.trim().length > 0 && isAirbnb.value && !isImporting.value
)
const placeholder = panelContent.airbnbPlaceholder

async function handleImport() {
  if (!canImport.value) return
  importError.value = null
  isImporting.value = true
  try {
    const data = await scrapeListing({ url: url.value.trim() })
    const transformed = transformAirbnbToRawListingBundle(
      data as AirbnbScrapedData
    )
    emit('patch', transformed as DraftPatch)
    importError.value = null
  } catch (err) {
    importError.value =
      err instanceof Error ? err.message : 'Impossible de récupérer l\'annonce.'
  } finally {
    isImporting.value = false
  }
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
            :placeholder="panelContent.airbnbPlaceholder"
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
              <span v-if="!isImporting">{{ panelContent.cta }}</span>
              <span v-else>{{ panelContent.importLoading }}</span>
            </button>
          </div>
        </div>
      </div>

      <p
        v-if="isBooking && url.trim()"
        class="booking-notice"
      >
        {{ panelContent.bookingNotSupported }}
      </p>

      <p class="create-manually">
        {{ panelContent.createManually }}
        <slot name="hint" />
      </p>
    </div>
  </CreateWizardStepShell>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;

.create-import-step-panel {
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-sm);

  > .input-row {
    > .input {
      @include inputs.action($theme: base, $action-theme: white);
    }
  }

  > .booking-notice {
    margin: 0;
    padding: 0.5rem 0.75rem;
    background: rgba($bad, 0.08);
    border-radius: 0.5rem;
    @include little-text($thin: false);
    color: rgba($bad, 0.95);
  }

  > .create-manually {
    margin: var(--layout-gap-sm) 0 0 0;
    @include little-text($thin: false);
    color: rgba($secondary-text, 0.65);
  }
}
</style>
