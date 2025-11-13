<!-- File: src/views/Landing/components/FeaturesSection/components/Feature/Feature.vue -->

<script setup lang="ts">
// UTILS
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
import type { FeatureItem } from '@/views/Landing/types/content'

// PROPS
const props = defineProps<{
  feature: FeatureItem
  index: number
}>()

const media = props.feature.images?.[0]
const video = props.feature.videos?.[0]
</script>

<template>
  <div class="feature container">
    <div>
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
            v-html="feature.description"
          />
        </div>
      </div>

      <div
        data-sr
        :data-sr-x="index % 2 !== 0 ? -50 : 50"
        :class="'media ' + (props.feature.layout || 'hzt')"
      >
        <video
          v-if="video?.webm || video?.mp4"
          autoplay
          loop
          muted
          playsinline
        >
          <source
            v-if="video?.webm"
            :src="video.webm"
            type="video/webm"
          />

          <source
            v-if="video?.mp4"
            :src="video.mp4"
            type="video/mp4"
          />

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
        </video>
        <img
          v-else-if="media?.webp"
          :src="media.webp"
          :onerror="media?.png ? `this.onerror=null; this.src='${media.png}';` : undefined"
          :alt="media?.alt || 'Feature image'"
          loading="lazy"
        />
      </div>

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
