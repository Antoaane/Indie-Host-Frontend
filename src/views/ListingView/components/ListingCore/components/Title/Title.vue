<!-- File: src/views/ListingView/components/ListingCore/components/Title/Title.vue -->

<script setup lang="ts">
// TYPES
import type { TitleModel } from '@/views/ListingView/types/listing'
import { computed } from 'vue'
import { formatICUMessage } from '@/utils/i18n'

interface StaticContent {
  travelers: string
  beds: string
  bedrooms: string
  bathrooms: string
}

const props = defineProps<{
  data: TitleModel
  staticContent: StaticContent
}>()

const travelerLabel = computed(() => formatICUMessage(props.staticContent.travelers, { count: props.data.guest_capacity }))

const bedroomLabel = computed(() => formatICUMessage(props.staticContent.bedrooms, { count: props.data.bedrooms.quantity }))

const bedsLabel = computed(() => formatICUMessage(props.staticContent.beds, { count: props.data.bedrooms.bed ?? 0 }))

const bathroomsLabel = computed(() => formatICUMessage(props.staticContent.bathrooms, { count: props.data.bathrooms }))
</script>

<template>
  <div class="title-listing__comp">
    <h1>
      {{ data.title }}
    </h1>
    <h2> {{ data.type }} — {{ data.location.city }}, {{ data.location.country }} </h2>
    <ul>
      <li> {{ data.guest_capacity }} {{ travelerLabel }} </li>

      <li>
        <span></span>
        {{ data.bedrooms.quantity }} {{ bedroomLabel }}
      </li>
      <li v-if="data.bedrooms.bed">
        <span></span>
        {{ data.bedrooms.bed }} {{ bedsLabel }}
      </li>
      <li>
        <span></span>
        {{ data.bathrooms }} {{ bathroomsLabel }}
      </li>
    </ul>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.title-listing__comp {
  h1 {
    @include h1-title($gradiant: true);
  }

  h2 {
    @include h2-title;
  }

  h2 {
    font-weight: 400;
  }

  ul {
    display: flex;
    align-items: center;

    opacity: 0.65;

    li {
      display: inline-flex;
      align-items: center;

      span {
        height: 5px;
        width: 5px;
        margin-inline: 0.5rem;
        margin-top: 3px;

        background-color: $secondary;
        border-radius: borders.$rounded;
      }
    }
  }
}
</style>
