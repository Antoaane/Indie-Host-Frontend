<!-- File: src/views/Landing/components/FeaturesSection/components/Feature/Feature.vue -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// UTILS
import detectOS from '@/utils/detectOs'
import { vp } from '@/utils/viewport'
// ASSETS
import GlowTopRight from '@/components/svgs/images/GlowTopRight.vue'
import GlowLeft from '@/components/svgs/images/GlowLeft.vue'
import GlowRight from '@/components/svgs/images/GlowRight.vue'
import GlowBottomLeft from '@/components/svgs/images/GlowBottomLeft.vue'
import GlowTopRightSharp from '@/components/svgs/images/GlowTopRightSharp.vue'
import GlowRightSharp from '@/components/svgs/images/GlowRightSharp.vue'
import GlowLeftSharp from '@/components/svgs/images/GlowLeftSharp.vue'
import GlowBottomLeftSharp from '@/components/svgs/images/GlowBottomLeftSharp.vue'
import LandingVideo from '@/views/Landing/components/LandingVideo/LandingVideo.vue'
import type { FeatureItem } from '@/views/Landing/types/content'

// PROPS
const props = defineProps<{
  feature: FeatureItem
  index: number
  isLast?: boolean
}>()

const media = props.feature.images?.[0]
const video = props.feature.videos?.[0]
const isIosMobile = ref(false)
const mobileDescriptionCharLimit = 220

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Nom accessible de la vidéo : la description de l'image équivalente, sinon le titre du bloc.
const videoLabel = computed(() => media?.alt || stripHtml(props.feature.title))

const displayDescription = computed(() => {
  if (props.feature.id !== 'transformezChaqueVisiteEnProchaineReservation') {
    return props.feature.description
  }

  const isTablet = vp.md.value && !vp.lg.value
  if (isTablet && props.feature.descriptionTablet) {
    return props.feature.descriptionTablet
  }

  if (vp.md.value) {
    return props.feature.description
  }

  const plainDescription = stripHtml(props.feature.description)

  if (plainDescription.length <= mobileDescriptionCharLimit) {
    return plainDescription
  }

  return `${plainDescription.slice(0, mobileDescriptionCharLimit).trimEnd()}...`
})

onMounted(async () => {
  const osInfo = await detectOS().catch(() => null)
  const normalizedOs = String(osInfo?.os ?? '').toLowerCase()
  isIosMobile.value = !vp.lg.value && (normalizedOs === 'ios' || normalizedOs === 'ipados')
})
</script>

<template>
  <div
    class="feature wrapper"
    :class="{
      'feature--media-left': props.isLast,
      'feature--halo-like-messages': props.feature.id === 'transformezChaqueVisiteEnProchaineReservation',
    }"
  >
    <div>
      <!-- Dernier bloc : vidéo à gauche, texte à droite -->
      <div
        v-if="props.isLast"
        data-sr
        :data-sr-x="index % 2 !== 0 ? -50 : 50"
        :class="'media ' + (props.feature.layout || 'hzt')"
      >
        <LandingVideo
          v-if="(video?.webm || video?.mp4) && !isIosMobile"
          :webm="video?.webm"
          :mp4="video?.mp4"
          :label="videoLabel"
        >
          <img
            v-if="media?.webp"
            :src="media.webp"
            :alt="media?.alt || 'Feature image'"
            loading="lazy"
          />
          <img
            v-if="media?.png"
            :src="media.png"
            :alt="media?.alt || 'Feature image'"
            loading="lazy"
          />
        </LandingVideo>
        <img
          v-else-if="media?.webp || media?.png"
          :src="media?.webp || media?.png"
          :onerror="media?.png ? `this.onerror=null; this.src='${media.png}';` : undefined"
          :alt="media?.alt || 'Feature image'"
          loading="lazy"
        />
      </div>

      <div
        v-if="props.isLast"
        class="text"
      >
        <div>
          <h2
            data-sr
            :data-sr-x="index % 2 !== 0 ? 50 : -50"
            v-html="feature.title"
          />
          <p
            data-sr
            :data-sr-x="index % 2 !== 0 ? 50 : -50"
            data-sr-delay="0.3"
            v-html="displayDescription"
          />
        </div>
      </div>

      <template v-if="!props.isLast">
      <div class="text">
        <div>
          <h2
            data-sr
            :data-sr-x="index % 2 !== 0 ? 50 : -50"
            v-html="feature.title"
          />

          <p
            data-sr
            :data-sr-x="index % 2 !== 0 ? 50 : -50"
            data-sr-delay="0.3"
            v-html="displayDescription"
          />
        </div>
      </div>

      <div
        data-sr
        :data-sr-x="index % 2 !== 0 ? -50 : 50"
        :class="'media ' + (props.feature.layout || 'hzt')"
      >
        <LandingVideo
          v-if="(video?.webm || video?.mp4) && !isIosMobile"
          :webm="video?.webm"
          :mp4="video?.mp4"
          :label="videoLabel"
        >
          <img
            v-if="media?.webp"
            :src="media.webp"
            :alt="media?.alt || 'Feature image'"
            loading="lazy"
          />

          <img
            v-if="media?.png"
            :src="media.png"
            :alt="media?.alt || 'Feature image'"
            loading="lazy"
          />
        </LandingVideo>
        <img
          v-else-if="media?.webp || media?.png"
          :src="media?.webp || media?.png"
          :onerror="media?.png ? `this.onerror=null; this.src='${media.png}';` : undefined"
          :alt="media?.alt || 'Feature image'"
          loading="lazy"
        />
      </div>
      </template>

      <template v-if="vp.md.value">
        <GlowTopRight
          class="decorative glow-top-right"
          aria-hidden="true"
        />
        <GlowRight
          class="decorative glow-right"
          aria-hidden="true"
        />
        <GlowLeft
          class="decorative glow-left"
          aria-hidden="true"
        />
        <GlowBottomLeft
          class="decorative glow-bottom-left"
          aria-hidden="true"
        />
      </template>
      <template v-else>
        <GlowTopRightSharp
          class="decorative glow-top-right"
          aria-hidden="true"
        />
        <GlowRightSharp
          class="decorative glow-right"
          aria-hidden="true"
        />
        <GlowLeftSharp
          class="decorative glow-left"
          aria-hidden="true"
        />
        <GlowBottomLeftSharp
          class="decorative glow-bottom-left"
          aria-hidden="true"
        />
      </template>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/Landing/components/FeaturesSection/components/Feature/feature.scss';
</style>
