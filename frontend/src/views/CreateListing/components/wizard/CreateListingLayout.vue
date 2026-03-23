<!-- File: src/views/CreateListing/components/wizard/CreateListingLayout.vue -->

<script setup lang="ts">
import { icons } from '@/components/svgs'
</script>

<template>
  <main
    id="create-listing-page"
    class="create-listing"
  >
  <div class="container">
    <component
      :is="icons.logoFull.adapt"
      title="IndieHost"
      desc="Logo de IndieHost, plateforme de gestion de locations saisonnières"
      role="img"
    />

    <div class="layout">
      <slot />
    </div>
  </div>
  </main>
</template>
