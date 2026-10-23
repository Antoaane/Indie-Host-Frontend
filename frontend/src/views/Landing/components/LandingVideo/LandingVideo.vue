<!-- File: src/views/Landing/components/LandingVideo/LandingVideo.vue -->
<!-- Vidéo de démonstration de la landing : lecture automatique silencieuse en boucle, avec un bouton
     lecture / pause posé sur l'angle inférieur droit de la vidéo. Pas de lecture automatique quand
     l'utilisateur préfère moins d'animations. Les attributs (class…) vont sur la balise <video> :
     le bouton est un frère, pour que les styles des sections qui ciblent `video` restent valables. -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Pause, Play } from 'lucide-vue-next'
import { getLandingContent } from '@/views/Landing/composables/useLandingLocale'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    webm?: string
    mp4?: string
    /** Nom accessible de la vidéo : ce qu'elle montre. */
    label: string
    preload?: 'none' | 'metadata' | 'auto'
  }>(),
  { preload: 'auto' },
)

const FALLBACK_CONTROLS = { play: 'Lire la vidéo', pause: 'Mettre en pause la vidéo' }
const controls = getLandingContent().videoControls ?? FALLBACK_CONTROLS

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
const shouldAutoplay = !prefersReducedMotion

const videoRef = ref<HTMLVideoElement | null>(null)
const toggleRef = ref<HTMLButtonElement | null>(null)
const isPlaying = ref(shouldAutoplay)
const isPositioned = ref(false)
const toggleStyle = ref<Record<string, string>>({})

const toggleLabel = computed(() => (isPlaying.value ? controls.pause : controls.play))

function syncState() {
  const video = videoRef.value
  if (video) isPlaying.value = !video.paused
}

function toggle() {
  const video = videoRef.value
  if (!video) return
  if (video.paused) {
    void video.play().catch(() => syncState())
  } else {
    video.pause()
  }
}

// Le bouton est positionné par rapport à l'ancêtre positionné commun : on le cale sur l'angle de
// la vidéo en la mesurant, quelle que soit la façon dont la section dimensionne et centre la vidéo.
const TOGGLE_GAP_PX = 12

function positionToggle() {
  const video = videoRef.value
  const button = toggleRef.value
  const parent = button?.offsetParent as HTMLElement | null
  if (!video || !button || !parent) return

  const videoRect = video.getBoundingClientRect()
  if (!videoRect.width || !videoRect.height) {
    isPositioned.value = false
    return
  }
  const parentRect = parent.getBoundingClientRect()
  const left = videoRect.right - (parentRect.left + parent.clientLeft) + parent.scrollLeft - button.offsetWidth - TOGGLE_GAP_PX
  const top = videoRect.bottom - (parentRect.top + parent.clientTop) + parent.scrollTop - button.offsetHeight - TOGGLE_GAP_PX
  toggleStyle.value = { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` }
  isPositioned.value = true
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  syncState()
  positionToggle()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => positionToggle())
    if (videoRef.value) resizeObserver.observe(videoRef.value)
    const parent = toggleRef.value?.offsetParent
    if (parent) resizeObserver.observe(parent)
  }
  window.addEventListener('resize', positionToggle, { passive: true })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', positionToggle)
})
</script>

<template>
  <video
    ref="videoRef"
    v-bind="$attrs"
    :aria-label="props.label"
    :autoplay="shouldAutoplay"
    :preload="props.preload"
    loop
    muted
    playsinline
    @play="syncState"
    @pause="syncState"
    @loadedmetadata="positionToggle"
  >
    <source
      v-if="props.webm"
      :src="props.webm"
      type="video/webm"
    />
    <source
      v-if="props.mp4"
      :src="props.mp4"
      type="video/mp4"
    />
    <slot />
  </video>
  <button
    ref="toggleRef"
    type="button"
    class="landing-video-toggle"
    :class="{ 'is-hidden': !isPositioned }"
    :style="toggleStyle"
    :aria-label="toggleLabel"
    @click="toggle"
  >
    <Pause
      v-if="isPlaying"
      :size="18"
      aria-hidden="true"
    />
    <Play
      v-else
      :size="18"
      aria-hidden="true"
    />
  </button>
</template>

<style lang="scss">
/* File: src/views/Landing/components/LandingVideo/LandingVideo.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

.landing-video-toggle {
  position: absolute;
  z-index: 2;

  // Cible tactile de 44 px.
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;

  border: 0;
  border-radius: borders.$rounded;
  color: $accent;
  background-color: rgba($secondary, 0.72);
  cursor: pointer;

  @include animations.transition();
  @include animations.press();

  @include on-hover {
    background-color: rgba($secondary, 0.9);
  }

  &:focus-visible {
    outline: 2px solid $accent;
    outline-offset: 2px;
  }

  &.is-hidden {
    visibility: hidden;
  }
}
</style>
