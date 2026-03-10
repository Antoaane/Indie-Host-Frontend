<!-- File: src/views/Landing/components/IntroSection/IntroSection.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { vp } from '@/utils/viewport'
import { orderByIndex } from '@/utils/medias/order'
import { ArrowLeft, ArrowRight, Loader2, Search } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import GradiantSeparator from '@/components/svgs/images/GradiantSeparator.vue'
import ListingView from '@/views/ListingView/_ListingView.vue'
import PreviewSkeleton from '@/views/Landing/components/IntroSection/PreviewSkeleton.vue'
import type { IntroSectionContent } from '@/views/Landing/types/content'
import type { RawListingBundle } from '@/domain/listings/types'
import {
  detectListingSource,
  scrapeListing,
  transformAirbnbToRawListingBundle,
  transformBookingToRawListingBundle,
} from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel'
import type { AirbnbScrapedData, BookingScrapedData } from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel'
import { buildPreviewBundle } from '@/views/Landing/components/IntroSection/buildPreviewBundle'
import { LANDING_IMPORT_URL_KEY } from '@/views/Landing/components/IntroSection/landingImportUrlKey'
import { useLandingImport } from '@/views/Landing/composables/useLandingImport'
import { LANDING_CREATE_DRAFT_KEY } from '@/views/CreateListing/wizard/createListingDraft'
import { setNavForcedHidden } from '@/components/navs/navUtils'

const props = defineProps<{
  content: IntroSectionContent
}>()

const router = useRouter()
const { pendingUrl, pendingRequestId } = useLandingImport()
const url = ref('')
const previewBundle = ref<RawListingBundle | null>(null)
const isPreviewLoading = ref(false)
const previewError = ref<string | null>(null)
const previewContainerRef = ref<HTMLElement | null>(null)
const mobileImportVideoSrc = '/assets/media/videos/import-auto-video.webm'

const displayedPreviewBundle = computed(() => previewBundle.value)
const isMobilePreviewFullscreen = computed(() => Boolean(previewBundle.value) && !vp.lg.value)
const showInlinePreview = computed(() => vp.lg.value)
const showInlineActivateCta = computed(() => Boolean(previewBundle.value) && !isPreviewLoading.value && vp.lg.value)
const showMobileLoadingHint = computed(() => isPreviewLoading.value && !vp.lg.value)
const showMobileTeaser = computed(() => !vp.lg.value && !isPreviewLoading.value && !previewBundle.value)
const mobilePreviewTopbarStyle = computed<Record<string, string>>(() => {
  const images = orderByIndex([...(displayedPreviewBundle.value?.medias?.images ?? [])])
  const coverSrc = images.find((image) => typeof image?.src === 'string' && image.src.trim())?.src?.trim()

  return {
    '--mobile-preview-cover-image': coverSrc ? `url(${JSON.stringify(coverSrc)})` : 'none',
  }
})

const canGenerate = computed(() => url.value.trim().length > 0 && !isPreviewLoading.value)

async function runPreview() {
  const trimmed = url.value.trim()
  previewBundle.value = null

  if (!trimmed) {
    previewError.value = "Collez un lien d'annonce pour prévisualiser."
    return
  }
  const source = detectListingSource(trimmed)
  if (source !== 'airbnb' && source !== 'booking') {
    previewError.value =
      "Lien non reconnu. Utilisez un lien Airbnb (https://www.airbnb.fr/rooms/…) ou Booking (https://www.booking.com/hotel/…)"
    return
  }
  previewError.value = null
  isPreviewLoading.value = true
  previewBundle.value = null
  try {
    const data = await scrapeListing({ url: trimmed })
    const partial =
      source === 'airbnb'
        ? transformAirbnbToRawListingBundle(data as AirbnbScrapedData)
        : transformBookingToRawListingBundle(data as BookingScrapedData)
    previewBundle.value = buildPreviewBundle(partial)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Impossible de récupérer l'annonce."
    // Message spécifique si Booking.com bloque le scraping
    if (source === 'booking' && msg.toLowerCase().includes('bloque')) {
      previewError.value = "Booking.com bloque l'import automatique. Essayez avec un lien Airbnb."
    } else {
      previewError.value = msg
    }
  } finally {
    isPreviewLoading.value = false
  }
}

watch(previewBundle, async (val) => {
  if (!val) return
  await nextTick()

  const container = previewContainerRef.value
  if (!container) return

  const core    = container.querySelector<HTMLElement>('#core, .core')
  const gallery = container.querySelector<HTMLElement>('.listing-gallery')
  const stay    = container.querySelector<HTMLElement>('.stay, .footer')

  if (!core && !gallery && !stay) return

  const els = [core, gallery, stay].filter(Boolean) as HTMLElement[]
  const shouldReduceMotion = !vp.lg.value && document.documentElement.classList.contains('is-ios')

  if (shouldReduceMotion) {
    gsap.set(els, { clearProps: 'all' })
    return
  }

  gsap.set(els, { opacity: 0, y: 16 })

  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
  // 1. Description / Core en premier
  if (core)    tl.to(core,    { opacity: 1, y: 0, duration: 1.1 })
  // 2. Photos
  if (gallery) tl.to(gallery, { opacity: 1, y: 0, duration: 1.0 }, '-=0.5')
  // 3. Booking + commentaires
  if (stay)    tl.to(stay,    { opacity: 1, y: 0, duration: 1.0 }, '-=0.5')
})

watch(pendingRequestId, () => {
  url.value = pendingUrl.value.trim()
  void runPreview()
})

function activateSite() {
  if (!previewBundle.value) return
  try {
    sessionStorage.setItem(LANDING_CREATE_DRAFT_KEY, JSON.stringify(previewBundle.value))
  } catch {
    // ignore storage errors (private mode, quota)
  }
  void router.push({ name: 'sign-up', query: { redirect_url: '/editor/create' } })
}

function closeMobilePreview() {
  previewBundle.value = null
  previewError.value = null
}

watch(isMobilePreviewFullscreen, (isFullscreen) => {
  if (typeof document === 'undefined') return
  setNavForcedHidden(isFullscreen)
  document.body.style.overflow = isFullscreen ? 'hidden' : ''
})

onMounted(() => {

  const storedUrl = sessionStorage.getItem(LANDING_IMPORT_URL_KEY)
  if (storedUrl?.trim()) {
    url.value = storedUrl.trim()
    runPreview()
  }
})

onBeforeUnmount(() => {
  setNavForcedHidden(false)
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})

</script>

<template>
  <section id="intro-section">
    <div class="gradiant-separator-wrapper">
      <GradiantSeparator
        class="gradiant-separator"
        title="DÃ©coration du fond"
        desc="SÃ©parateur dÃ©coratif"
      />
    </div>
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
          class="import-row"
          data-sr
          data-sr-y="15"
        >
          <div class="import-input">
            <Search class="icon" />
            <input
              v-model="url"
              type="url"
              :placeholder="content.inputPlaceholder"
              autocomplete="url"
              :disabled="isPreviewLoading"
              @keydown.enter.prevent="runPreview"
            />
          </div>
          <div class="generate-btn">
            <button
              type="button"
              :disabled="isPreviewLoading"
              @click="runPreview"
            >
              <Loader2
                v-if="isPreviewLoading"
                class="icon is-spinning"
              />
              <span v-else>{{ content.previewCtaLabel }}</span>
            </button>
          </div>
        </div>
        <p
          v-if="previewError"
          class="preview-error"
        >
          {{ previewError }}
        </p>

        <div
          v-if="showMobileLoadingHint"
          class="mobile-loading-hint"
        >
          <Loader2 class="icon is-spinning" />
          <span>Récupération de votre annonce…</span>
        </div>

        <div
          v-if="showMobileTeaser"
          class="mobile-import-teaser"
        >
          <span class="teaser-badge">Airbnb</span>
          <span class="teaser-sep">·</span>
          <span class="teaser-badge">Booking.com</span>
        </div>

        <div
          v-if="showMobileTeaser"
          class="mobile-import-demo"
        >
          <video
            autoplay
            loop
            muted
            playsinline
            preload="metadata"
          >
            <source
              :src="mobileImportVideoSrc"
              type="video/webm"
            />
          </video>
        </div>

        <Transition name="activate-reveal">
          <div
            v-if="showInlineActivateCta"
            class="activate-cta"
          >
            <div class="activate-btn">
              <button
                type="button"
                @click="activateSite"
              >
                {{ content.createAccountCtaLabel }}
                <ArrowRight class="icon" />
              </button>
            </div>
            <p
              v-if="content.createAccountCtaHint"
              class="activate-hint"
            >
              {{ content.createAccountCtaHint }}
            </p>
          </div>
        </Transition>
      </div>

      <div
        v-if="showInlinePreview"
        ref="previewContainerRef"
        class="embed-preview"
      >
        <div
          v-if="isPreviewLoading"
          class="embed-skeleton"
        >
          Récupération de votre annonce…
        </div>
        <div
          v-else
          class="embed-stage"
        >
          <div
            class="embed-scale"
          >
            <Transition
              name="preview-reveal"
              mode="out-in"
            >
              <PreviewSkeleton
                v-if="!displayedPreviewBundle"
                key="skeleton"
              />
              <ListingView
                v-else
                key="listing"
                :raw-listing="displayedPreviewBundle"
                :forced-viewport-mode="vp.lg ? 'xxl' : 'sm'"
                :preview-only="true"
              />
            </Transition>
          </div>
        </div>
      </div>

      <Transition name="mobile-preview-fullscreen">
        <div
          v-if="isMobilePreviewFullscreen"
          ref="previewContainerRef"
          class="mobile-preview-fullscreen"
          :style="mobilePreviewTopbarStyle"
        >
          <div
            class="mobile-preview-topbar"
            :style="mobilePreviewTopbarStyle"
          >
            <div class="mobile-preview-back">
              <button
                type="button"
                @click="closeMobilePreview"
                :aria-label="content.backButtonAriaLabel ?? 'Retour'"
              >
                <ArrowLeft class="icon" />
              </button>
            </div>

            <div class="mobile-preview-cta">
              <button
                type="button"
                @click="activateSite"
              >
                {{ content.createAccountCtaLabel }}
                <ArrowRight class="icon" />
              </button>
            </div>
          </div>

          <div class="mobile-preview-stage">
            <ListingView
              :raw-listing="displayedPreviewBundle"
              :forced-viewport-mode="'sm'"
              :preview-only="true"
            />
          </div>
        </div>
      </Transition>

    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/IntroSection/intro-section.scss';
</style>
