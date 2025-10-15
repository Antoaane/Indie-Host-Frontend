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

// PROPS
const props = defineProps<{
  feature: {
    title: string
    description: string
    animated?: boolean
    'video-1'?: string
    'video-2'?: string
    image?: string
    'image-1'?: string
    'image-2'?: string
    format?: 'hzt' | 'vtc' | 'sqr'
    alt?: string
  }
}>()
</script>

<template>
  <div class="feature container">
    <div>
      <div class="text">
        <div>
          <h2 v-html="feature.title" />

          <p v-html="feature.description" />
        </div>
      </div>

      <div :class="'media ' + props.feature.format || 'hzt'">
        <!-- <img
          class="default-theme"
          src="/assets/media/images/webp/default-theme.webp"
          onerror="this.onerror=null; this.src='/assets/media/images/png/default-theme.png';"
        /> -->
        <video
          v-if="feature['video-1'] && feature['video-2']"
          :poster="feature.image"
          autoplay
          loop
          muted
          playsinline
        >
          <source
            :src="feature['video-1']"
            type="video/webm"
          />

          <source
            :src="feature['video-2']"
            type="video/mp4"
          />

          <img
            :src="feature['image-1']"
            :alt="feature.alt || 'Feature image'"
            loading="lazy"
          />

          <img
            :src="feature['image-2']"
            :alt="feature.alt || 'Feature image'"
            loading="lazy"
          />
        </video>
        <!-- <img
          v-else-if="feature.image"
          :src="feature['image-1']"
          onerror="this.onerror=null; this.src=feature['image-2'];"
          :alt="feature.alt || 'Feature image'"
          loading="lazy"
        /> -->
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
