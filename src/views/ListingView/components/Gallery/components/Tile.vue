<!-- File: src/views/ListingView/components/Gallery/components/Tile.vue -->

<script setup lang="ts">
const props = defineProps<{
  styleObj: Record<string, string>
  src: string
  alt?: string
  objPos?: string
}>()
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <div
    class="tile"
    :style="props.styleObj"
  >
    <button
      class="tile-btn"
      type="button"
      @click="$emit('click')"
    >
      <img
        :src="props.src"
        :alt="props.alt || ''"
        :style="{ objectPosition: props.objPos }"
        class="tile-img"
        draggable="false"
      />
    </button>
  </div>
</template>
