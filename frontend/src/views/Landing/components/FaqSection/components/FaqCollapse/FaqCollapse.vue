<!-- File: src/views/Landing/components/FaqSection/components/FaqCollapse/FaqCollapse.vue -->

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'

// Génère un ID unique pour aria-controls
const id = `faq-collapse-${Math.random().toString(36).substr(2, 9)}`

const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="faq-collapse">
    <!-- Bouton résumé -->
    <button
      class="faq-summary"
      @click="toggle"
      :aria-expanded="isOpen"
      :aria-controls="id"
      :title="isOpen ? 'Réduire la réponse' : 'Afficher la réponse'"
      type="button"
    >
      <slot name="summary" />
      <ChevronLeft
        :size="18"
        :class="{ 'faq-chevron': true, open: isOpen }"
      />
    </button>

    <!-- Contenu caché / affiché -->
    <transition name="faq-fade-height">
      <div
        v-show="isOpen"
        class="faq-content"
        :id="id"
        :aria-hidden="!isOpen"
      >
        <slot name="content" />
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
@use '@/views/Landing/components/FaqSection/components/FaqCollapse/faq-collapse.scss';
</style>
