<!-- File: src/views/Landing/FaqSection/components/FaqCollapse.vue -->

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
@use '@/assets/styles/variables/globals' as *;
@use '@/assets/styles/variables/animations' as animations;

// Container global
.faq-list > li {
  .faq-collapse {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    @include gutters(padding, vertical, 0.25);
  }

  > .faq-collapse {
    @include gutters(padding, vertical);

    .faq-summary {
      width: 100%;
      padding: 0.5rem 0;

      display: flex;
      justify-content: space-between;
      align-items: center;

      gap: 0.5rem;

      background: none;
      border: none;

      text-align: left;

      cursor: pointer;
      @include animations.transition;

      h3 {
        margin: 0 !important;
        text-align: left !important;
        @include h3-title($accent);
      }

      h4 {
        margin: 0 !important;
        text-align: left !important;
        @include h4-title($accent);
      }

      .lucide-chevron-left-icon {
        min-width: 18px;
        stroke: $accent;
        @include animations.transition;

        &.open {
          transform: rotate(-90deg);
        }
      }
    }
  }

  .faq-content {
    overflow: visible;
    @include gutters(padding, inline, 1.5);

    ul {
      padding: 0;
      list-style: none;

      p {
        position: relative;
        text-align: left !important;
        @include little-text($accent);

        // &:after {
        //   content: ' ';
        //   display: block;
        //   width: 0.75rem;
        //   height: calc(50% + (var(--gutter-spacing) * 0.25));

        //   position: absolute;
        //   left: -1.5rem;
        //   top: calc((var(--gutter-spacing) * 0.25) * (-1));

        //   border-left: 1px solid $accent;
        //   border-bottom: 1px solid $accent;
        //   border-bottom-left-radius: borders.$rounded-sm;
        // }
      }
    }
  }
}

.faq-content {
  overflow: hidden;
  padding-left: 1rem;
  border-left: 2px solid rgba($accent, 0.3);
}

// Animation “height + opacity”
.faq-fade-height-enter-active,
.faq-fade-height-leave-active {
  transition: all 0.35s cubic-bezier(0.8, 0, 0.2, 1);
}
.faq-fade-height-enter-from,
.faq-fade-height-leave-to {
  max-height: 0;
  opacity: 0;
  padding: 0;
  margin: 0;
}
.faq-fade-height-enter-to,
.faq-fade-height-leave-from {
  max-height: 100vh;
  opacity: 1;
}
</style>
