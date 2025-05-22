<!-- File: src/components/faq/FaqCollapse.vue -->

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'

const open = ref(false)
const contentEl = ref<HTMLElement | null>(null)

const id = `faq-content-${Math.random().toString(36).substr(2, 9)}` // id unique pour aria-controls

function toggle() {
  open.value = !open.value
  // nextTick(() => {
  //   if (open.value) contentEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // })
}
</script>

<template>
  <div class="faq-collapse">
    <button
      class="faq-summary"
      @click="toggle"
      :aria-expanded="open.toString()"
      :aria-controls="id"
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
        :id="id"
        ref="contentEl"
        :aria-hidden="(!open).toString()"
      >
        <slot name="content" />
      </div>
    </transition>
  </div>
</template>
