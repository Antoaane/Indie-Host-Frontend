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
@use '@/styles/variables/animations' as animations;

.listing-gallery-tile {
  position: absolute;
  min-width: 1px;
  min-height: 1px;

  will-change: left, top, width, height, transform, opacity;
  // Recomposition ambiante de la mosaïque (toutes les 10 s) : les tuiles se
  // déplacent à l'écran, d'où l'ease-in-out lent ; le fondu reste en ease-out.
  @include animations.transition(
    (1000ms, 1000ms, 1000ms, 1000ms, 750ms, 500ms),
    (animations.$ease-in-out, animations.$ease-in-out, animations.$ease-in-out, animations.$ease-in-out, animations.$ease-in-out, animations.$ease-out),
    (left, top, width, height, transform, opacity)
  );

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
    @include animations.transition();
    @include animations.press(0.98);

    > .image {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      // object-position: center center;
      transform: translateZ(0);
      border-radius: 5px;

      // Ken Burns lent : part avec la recomposition puis se pose en douceur.
      @include animations.transition(10000ms, animations.$ease-out, object-position);
    }
  }

  @include animations.reduced-motion {
    @include animations.transition(500ms, animations.$ease-out, opacity);

    > .button > .image {
      transition: none;
    }
  }
}

</style>
