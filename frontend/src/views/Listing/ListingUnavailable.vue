<!-- File: src/views/Listing/ListingUnavailable.vue -->

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    message?: string
  }>(),
  {
    title: 'Annonce indisponible',
    message: 'Cette annonce n’est plus en ligne temporairement.',
  },
)
</script>

<template>
  <section class="listing-unavailable">
    <div class="content">
      <p class="eyebrow">Indie Host</p>
      <h1>{{ props.title }}</h1>
      <p class="message">{{ props.message }}</p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Listing/listing-unavailable.scss';
</style>
