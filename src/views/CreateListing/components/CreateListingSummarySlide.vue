<!-- File: src/views/CreateListing/components/CreateListingSummarySlide.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import type { RawListingBundle } from '@/domain/listings/types'
import { formatICUMessage } from '@/utils/i18n'
import { editorStatic } from '@/views/Editor/utils/editorContent'

const props = defineProps<{
  draft: RawListingBundle
}>()

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const title = computed(() => (props.draft.core?.title ?? '').trim() || 'Annonce sans titre')
const type = computed(() => (props.draft.core?.type ?? '').trim() || 'Non renseigné')
const location = computed(() => {
  const city = (props.draft.core?.city ?? '').trim()
  const country = (props.draft.core?.country ?? '').trim()
  const region = (props.draft.core?.region ?? '').trim()
  return (
    [
      city,
      region,
      country,
    ]
      .filter(Boolean)
      .join(' · ') || 'Non renseignée'
  )
})
const guestCapacity = computed(() => Number(props.draft.core?.guest_capacity ?? 0))
const guestLabel = computed(() => formatICUMessage(editorStatic.listings.guests, { count: Math.max(guestCapacity.value, 0) }))
const amenitiesCount = computed(() => (Array.isArray(props.draft.core?.amenities) ? props.draft.core?.amenities.length : 0))
const roomsCount = computed(() => (Array.isArray(props.draft.core?.rooms) ? props.draft.core?.rooms.length : 0))
const imagesCount = computed(() => {
  if (!Array.isArray(props.draft.medias?.images)) return 0
  return props.draft.medias.images.filter((item) => typeof item?.src === 'string' && item.src.trim()).length
})
const descriptionLength = computed(() => stripHtml(props.draft.core?.description ?? '').length)
const nightlyPrice = computed(() => Number(props.draft.bookings?.price ?? 0))
</script>

<template>
  <section class="create-listing-summary-slide">
    <div class="header">
      <h3>Récapitulatif de l’annonce</h3>
      <p>Vérifie les informations principales avant création.</p>
    </div>

    <div class="body">
      <div class="grid">
        <article class="item">
          <h4>Titre</h4>
          <p>{{ title }}</p>
        </article>
        <article class="item">
          <h4>Type de logement</h4>
          <p>{{ type }}</p>
        </article>
        <article class="item">
          <h4>Localisation</h4>
          <p>{{ location }}</p>
        </article>
        <article class="item">
          <h4>Capacité</h4>
          <p>{{ guestCapacity }} {{ guestLabel }}</p>
        </article>
        <article class="item">
          <h4>Pièces</h4>
          <p>{{ roomsCount }}</p>
        </article>
        <article class="item">
          <h4>Équipements</h4>
          <p>{{ amenitiesCount }}</p>
        </article>
        <article class="item">
          <h4>Photos</h4>
          <p>{{ imagesCount }}</p>
        </article>
        <article class="item">
          <h4>Description</h4>
          <p>{{ descriptionLength }} caractères</p>
        </article>
        <article class="item">
          <h4>Tarif de base</h4>
          <p>{{ nightlyPrice }} € / nuit</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/create-listing-summary-slide.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.create-listing-summary-slide {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .grid {
      display: grid;
      grid-template-columns: repeat(1, minmax(0, 1fr));
      gap: var(--layout-gap-xs);

      @include min-width(md) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      > .item {
        border: 1px solid rgba($secondary, 0.08);
        border-radius: borders.$rounded-md;
        padding: var(--layout-gap-sm);
        background: $accent-surface-0;

        > h4 {
          margin: 0;
          @include h4-title();
        }

        > p {
          margin: 0.25rem 0 0 0;
          @include little-text($thin: false);
          color: rgba($secondary, 0.75);
        }
      }
    }
  }
}
</style>
