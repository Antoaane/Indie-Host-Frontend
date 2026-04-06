<!-- File: src/views/CreateListing/components/wizard/CreateListingLayout.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { readActiveUserId } from '@/router/backOfficeUser'
import { icons } from '@/components/svgs'

const route = useRoute()
const emit = defineEmits<{
  (event: 'cancel'): void
}>()

const dashboardLink = computed(() => {
  const userId = readActiveUserId(route.params.userId)

  if (userId) {
    return {
      name: 'editor-user',
      params: { userId },
    }
  }

  return { name: 'editor' }
})
</script>

<template>
  <section
    id="create-listing-page"
    class="create-listing"
  >
    <div class="create-listing-quit">
      <button
        type="button"
        @click="emit('cancel')"
      >
        Quitter
      </button>
    </div>

    <div class="container">
      <RouterLink
        class="create-listing-logo-link"
        :to="dashboardLink"
        aria-label="Accéder au dashboard"
      >
        <component
          :is="icons.logoFull.adapt"
          title="IndieHost"
          desc="Logo de IndieHost, plateforme de gestion de locations saisonnières"
          role="img"
        />
      </RouterLink>

      <div class="layout">
        <slot />
      </div>
    </div>
  </section>
</template>
