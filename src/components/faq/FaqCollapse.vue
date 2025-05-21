<!-- File: src/components/faq/FaqCollapse.vue -->

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'

const open = ref(false)
const contentEl = ref<HTMLElement | null>(null)
function toggle() {
  open.value = !open.value
  // Optionnel : scroll auto jusqu'à la question ouverte
  // if (open.value) {
  //   nextTick(() => {
  //     contentEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  //   })
  // }
}
</script>

<template>
  <div class="faq-collapse">
    <button
      class="faq-summary"
      @click="toggle"
      :aria-expanded="open.toString()"
    >
      <slot name="summary" />
      <ChevronLeft
        :size="18"
        :class="{ 'faq-chevron': true, open: open }"
      />
    </button>
    <transition name="faq-fade-height">
      <div
        v-show="open"
        class="faq-content"
        ref="contentEl"
        :aria-hidden="(!open).toString()"
      >
        <slot name="content" />
      </div>
    </transition>
  </div>
</template>
