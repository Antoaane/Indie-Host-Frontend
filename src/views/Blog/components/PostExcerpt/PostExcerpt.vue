<!-- File: src/views/Blog/components/PostExcerpt/PostExcerpt.vue -->

<script setup lang="ts">
interface Props {
  excerpt?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div
    v-if="excerpt"
    class="post-excerpt"
  >
    <p class="post-excerpt__text">{{ excerpt }}</p>
  </div>
</template>

<style lang="scss" src="./PostExcerpt.scss"></style>
