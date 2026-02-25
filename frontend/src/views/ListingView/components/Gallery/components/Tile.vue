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
    class="listing-gallery-tile"
    :style="props.styleObj"
  >
    <button
      class="button"
      type="button"
      @click="$emit('click')"
    >
      <img
        :src="props.src"
        :alt="props.alt || ''"
        :style="{ objectPosition: props.objPos }"
        class="image"
        draggable="false"
      />
    </button>
  </div>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Gallery/components/tile.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-gallery-tile {
  position: absolute;
  min-width: 1px;
  min-height: 1px;

  will-change: left, top, width, height, transform, opacity;
  transition:
    left 1000ms cubic-bezier(0.8, 0, 0.2, 1),
    top 1000ms cubic-bezier(0.8, 0, 0.2, 1),
    width 1000ms cubic-bezier(0.8, 0, 0.2, 1),
    height 1000ms cubic-bezier(0.8, 0, 0.2, 1),
    transform 750ms cubic-bezier(0.8, 0, 0.2, 1),
    opacity 500ms ease-out;

  transform-origin: center center;

  > .button {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    background: transparent;
    border: 0;
    cursor: pointer;

    > .image {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      // object-position: center center;
      transform: translateZ(0);
      border-radius: 5px;

      transition: object-position 10000ms cubic-bezier(0.20, 0, 0.80, 1), ;
    }
  }
}

</style>
