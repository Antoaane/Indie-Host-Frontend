<!-- File: src/views/Landing/components/IntroSection/PreviewSkeleton.vue -->

<script setup lang="ts">
import { vp } from '@/utils/viewport'
</script>

<template>
  <div class="listing-view preview-skeleton">
    <!-- Layout desktop : gallery | core | stay -->
    <template v-if="vp.lg.value">
      <div class="gallery">
        <div class="skeleton-placeholder gallery-placeholder" aria-hidden="true" />
      </div>
      <div class="core">
        <div class="skeleton-placeholder core-placeholder" aria-hidden="true" />
      </div>
      <div class="stay">
        <div class="skeleton-placeholder booking-placeholder" aria-hidden="true" />
        <div class="skeleton-placeholder comments-placeholder" aria-hidden="true" />
      </div>
    </template>

    <!-- Layout mobile : main + footer -->
    <template v-else>
      <div class="main">
        <div class="gallery">
          <div class="skeleton-placeholder gallery-placeholder" aria-hidden="true" />
        </div>
        <div class="core">
          <div class="panel">
            <div class="skeleton-placeholder core-placeholder" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div class="footer">
        <div class="skeleton-placeholder booking-placeholder" aria-hidden="true" />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/views/ListingView/listing-view.scss';

.preview-skeleton {
  --listing-view-cover-image: none;

  background: rgba($accent, 0.35) !important;
  backdrop-filter: blur(20px);

  &::before {
    display: none;
  }

  .skeleton-placeholder {
    width: 100%;
    height: 100%;
    min-height: 4rem;
    border-radius: borders.$rounded-md;

    background: rgba($accent, 0.35) !important;
    backdrop-filter: blur(40px);
  }

  .gallery-placeholder {
    min-height: 12rem;
    @include min-width(lg) {
      min-height: 100%;
    }
  }

  .core-placeholder {
    min-height: 8rem;
  }

  .booking-placeholder {
    flex: 0 1 33%;
  }

  .comments-placeholder {
    flex: 1 0 4rem;
  }
}
</style>
