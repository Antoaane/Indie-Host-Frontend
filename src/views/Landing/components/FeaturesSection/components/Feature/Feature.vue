<!-- File: src/views/Landing/components/FeaturesSection/components/Feature/Feature.vue -->

<script setup lang="ts">
// UTILS
import { vp } from '@/utils/viewport'
// ASSETS
import Left from '@/components/svgs/images/Left.vue'
import Right from '@/components/svgs/images/Right.vue'
import EndLeft from '@/components/svgs/images/EndLeft.vue'
import RightSharp from '@/components/svgs/images/RightSharp.vue'
import LeftSharp from '@/components/svgs/images/LeftSharp.vue'
import EndLeftSharp from '@/components/svgs/images/EndLeftSharp.vue'

// PROPS
const props = defineProps<{
  feature: {
    title: string
    description: string
    'video-1'?: string
    'video-2'?: string
    image?: string
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
            :src="feature.image"
            :alt="feature.alt || 'Feature image'"
            loading="lazy"
          />
        </video>
        <img
          v-else-if="feature.image"
          :src="feature.image"
          :alt="feature.alt || 'Feature image'"
          loading="lazy"
        />
      </div>

      <template v-if="vp.md.value">
        <Right
          class="decorative right"
          aria-hidden="true"
        />
        <Left
          class="decorative left"
          aria-hidden="true"
        />
        <EndLeft
          class="decorative end-left"
          aria-hidden="true"
        />
      </template>
      <template v-else>
        <RightSharp
          class="decorative right"
          aria-hidden="true"
        />
        <LeftSharp
          class="decorative left"
          aria-hidden="true"
        />
        <EndLeftSharp
          class="decorative end-left"
          aria-hidden="true"
        />
      </template>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/Landing/components/FeaturesSection/components/Feature/feature.scss';
</style>
