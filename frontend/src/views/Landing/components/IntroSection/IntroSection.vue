<!-- File: src/views/Landing/components/IntroSection/IntroSection.vue -->

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import GradiantSeparator from '@/components/svgs/images/GradiantSeparator.vue'
import ListingView from '@/views/ListingView/_ListingView.vue'
import type { IntroSectionContent } from '@/views/Landing/types/content'
import type { RawListingBundle } from '@/domain/listings/types'
import {
  detectListingSource,
  scrapeListing,
  transformAirbnbToRawListingBundle,
} from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel'
import type { AirbnbScrapedData } from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel'
import { buildPreviewBundle } from '@/views/Landing/components/IntroSection/buildPreviewBundle'
import { LANDING_CREATE_DRAFT_KEY } from '@/views/CreateListing/wizard/createListingDraft'
import { LANDING_IMPORT_URL_KEY } from '@/views/Landing/components/IntroSection/landingImportUrlKey'

const props = defineProps<{
  content: IntroSectionContent
}>()

const url = ref('')
const previewBundle = ref<RawListingBundle | null>(null)
const isPreviewLoading = ref(false)
const previewError = ref<string | null>(null)
const previewContainerRef = ref<HTMLElement | null>(null)
const previewAspect = ref<{ width: number; height: number }>({ width: 800, height: 480 })

function saveUrlAndNavigate(e?: Event) {
  const trimmed = url.value.trim()
  if (trimmed) {
    try {
      sessionStorage.setItem(LANDING_IMPORT_URL_KEY, trimmed)
    } catch {
      // ignore storage errors
    }
  }
  const href = props.content.primaryCta.href
  if (href.startsWith('#')) {
    e?.preventDefault()
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }
}

async function runPreview() {
  const trimmed = url.value.trim()
  if (!trimmed) {
    previewError.value = 'Collez un lien d’annonce pour prévisualiser.'
    return
  }
  const source = detectListingSource(trimmed)
  if (source === 'booking') {
    previewError.value = "L'import Booking n'est pas encore disponible. Utilisez un lien Airbnb."
    return
  }
  if (source !== 'airbnb') {
    previewError.value = "Lien non reconnu. Utilisez un lien Airbnb du type https://www.airbnb.fr/rooms/…"
    return
  }
  previewError.value = null
  isPreviewLoading.value = true
  previewBundle.value = null
  try {
    const data = await scrapeListing({ url: trimmed })
    const partial = transformAirbnbToRawListingBundle(data as AirbnbScrapedData)
    previewBundle.value = buildPreviewBundle(partial)
  } catch (err) {
    previewError.value = err instanceof Error ? err.message : "Impossible de récupérer l'annonce."
  } finally {
    isPreviewLoading.value = false
  }
}

function updatePreviewAspect() {
  nextTick(() => {
    const el = previewContainerRef.value
    if (el) {
      previewAspect.value = { width: el.clientWidth || 800, height: Math.min(520, el.clientHeight || 480) }
    }
  })
}

watch(previewBundle, (value) => {
  if (value) {
    updatePreviewAspect()
  }
})

/** Enregistre l’URL et le brouillon (si prévisualisé) en cache puis envoie vers la section inscription. */
function saveDraftAndNavigateToSignup(e?: Event) {
  const trimmed = url.value.trim()
  if (trimmed) {
    try {
      sessionStorage.setItem(LANDING_IMPORT_URL_KEY, trimmed)
    } catch {
      // ignore
    }
  }
  const bundle = previewBundle.value
  if (bundle) {
    try {
      sessionStorage.setItem(LANDING_CREATE_DRAFT_KEY, JSON.stringify(bundle))
    } catch {
      // ignore
    }
  }
  const href = props.content.primaryCta.href
  if (href.startsWith('#')) {
    e?.preventDefault()
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>

<template>
  <section id="intro-section">
    <GradiantSeparator
      class="gradiant-separator"
      title="Décoration du fond"
      desc="Séparateur décoratif"
    />
    <div class="wrapper">
      <div class="block">
        <h2
          data-sr
          data-sr-y="-20"
          v-html="content.title"
        />
        <p
          data-sr
          data-sr-y="20"
          v-html="content.body"
        />
        <div
          class="input-row"
          data-sr
          data-sr-y="15"
        >
          <div class="url-input">
            <input
              v-model="url"
              type="url"
              :placeholder="content.inputPlaceholder"
              autocomplete="url"
              :disabled="isPreviewLoading"
              @keydown.enter.prevent="runPreview"
            />
          </div>
        </div>
        <div
          class="actions"
          data-sr
          data-sr-y="15"
        >
          <button
            type="button"
            class="cta cta-preview"
            :disabled="isPreviewLoading"
            @click="runPreview"
          >
            <span v-if="isPreviewLoading">Chargement…</span>
            <span v-else v-html="content.previewCtaLabel" />
          </button>
          <a
            class="cta"
            :href="content.primaryCta.href"
            :target="content.primaryCta.target"
            :rel="content.primaryCta.rel || (content.primaryCta.target === '_blank' ? 'noopener noreferrer' : undefined)"
            v-html="content.primaryCta.label"
            @click="saveUrlAndNavigate"
          />
        </div>
        <p
          v-if="previewError"
          class="preview-error"
        >
          {{ previewError }}
        </p>
      </div>

      <div
        v-if="previewBundle || isPreviewLoading"
        ref="previewContainerRef"
        class="embed-preview"
      >
        <div
          v-if="isPreviewLoading"
          class="embed-skeleton"
        >
          Récupération de votre annonce…
        </div>
        <ListingView
          v-else-if="previewBundle"
          :raw-listing="previewBundle"
          :aspect="previewAspect"
          :forced-viewport-mode="'xxl'"
          :preview-only="true"
        />
      </div>

      <div
        v-if="previewBundle || isPreviewLoading"
        class="create-account-row"
      >
        <button
          type="button"
          class="cta cta-create-account"
          @click="saveDraftAndNavigateToSignup"
        >
          {{ content.createAccountCtaLabel }}
        </button>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/IntroSection/intro-section.scss';
</style>
