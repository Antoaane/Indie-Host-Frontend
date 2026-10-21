<!-- File: src/views/ListingView/components/Gallery/ListingVideos.vue -->
<!-- Vidéos du logement, affichées sous la galerie photos de l'annonce publique. -->

<script setup lang="ts">
import { computed } from 'vue'

import type { VideoItem } from '@/views/ListingView/types/listing'

const props = defineProps<{
  videos?: VideoItem[] | null
}>()

const videos = computed(() => (props.videos ?? []).filter((video) => typeof video?.src === 'string' && video.src.trim()))
</script>

<template>
  <section
    v-if="videos.length"
    class="listing-videos"
    aria-labelledby="listing-videos-title"
  >
    <h2 id="listing-videos-title">
      {{ videos.length > 1 ? 'Vidéos du logement' : 'Vidéo du logement' }}
    </h2>
    <div
      class="videos-grid"
      :class="{ 'is-single': videos.length === 1 }"
    >
      <figure
        v-for="(video, index) in videos"
        :key="`${video.src}-${index}`"
      >
        <video
          :src="video.src"
          :poster="video.poster || undefined"
          controls
          playsinline
          preload="metadata"
        >
          Votre navigateur ne peut pas lire cette vidéo.
        </video>
        <figcaption v-if="video.alt">
          {{ video.alt }}
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-videos {
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap);

  > h2 {
    margin: 0;
    @include h2-title($gradiant: true);
  }

  > .videos-grid {
    display: grid;
    @include responsive-grid-columns(18rem);
    gap: var(--layout-gap);

    &.is-single {
      grid-template-columns: minmax(0, 1fr);
    }

    > figure {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      > video {
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: borders.$rounded-md;
        background: $secondary;
        object-fit: contain;
      }

      > figcaption {
        @include little-text($thin: false);
        color: rgba($secondary, 0.65);
      }
    }
  }
}
</style>
