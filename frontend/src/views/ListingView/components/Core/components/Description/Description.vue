<!-- File: src/views/ListingView/components/Core/components/Description/Description.vue -->

<script setup lang="ts">
// ASSETS
import { X } from 'lucide-vue-next'
// VUE
import { ref } from 'vue'
import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'
// TYPES
import type { DescriptionModel } from '@/views/ListingView/types/listing'

interface StaticContent {
  title: string
  ctaLabel: string
}

const props = defineProps<{
  data: DescriptionModel
  staticContent: StaticContent
}>()

const staticContent = props.staticContent

/* ---------- state ---------- */
const isOpen = ref(false)

/* ---------- actions ---------- */
function openPopup() {
  if (isOpen.value) return
  isOpen.value = true
}
function closePopup() {
  if (!isOpen.value) return
  isOpen.value = false
}
</script>

<template>
  <section class="listing-description">
    <h2>
      {{ staticContent.title }}
    </h2>

    <span
      class="preview--editorial"
      v-html="data.description"
    />

    <div class="trigger">
      <button
        type="button"
        :aria-expanded="isOpen"
        :aria-controls="'listing-description-dialog'"
        :title="staticContent.ctaLabel"
        v-html="staticContent.ctaLabel"
        @click="openPopup"
      />
    </div>

    <AbsoluteOverlay
      id="listing-description-dialog"
      class="listing-description-overlay"
      :open="isOpen"
      :aria-hidden="!isOpen"
      aria-label="Description du logement"
      @close="closePopup"
    >
      <div class="panel">
        <div class="close">
          <div class="button">
            <button
              type="button"
              aria-label="Fermer"
              @click="closePopup" title="Fermer"
            >
              <X />
            </button>
          </div>
        </div>

        <h2 v-html="staticContent.title" />
        <span
          class="content"
          v-html="data.description"
        />
        <!-- <div class="block">
            <p v-html="data.brief" />
          </div>
          <div
            v-for="block in data.blocks"
            :key="block.title"
            class="block"
          >
            <h3 v-html="block.title" />
            <p v-html="block.content" />
          </div> -->
      </div>
    </AbsoluteOverlay>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Core/components/Description/description.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;
@use '@/styles/components/overlays' as overlays;

.listing-description {
  > h2 {
    margin-bottom: var(--layout-gap-sm) !important;
    @include h2-title($gradiant: true);
  }

  > .preview--editorial {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    /* Nombre de lignes visibles */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;

    > span {
      @include base-text($thin: false);
    }

    h3 {
      margin-top: var(--layout-gap-sm) !important;
      margin-bottom: var(--layout-gap-xs) !important;
      @include h4-title;
    }

    h2 {
      margin-top: var(--layout-gap-sm) !important;
      margin-bottom: var(--layout-gap-xs) !important;
      @include h3-title;
    }

    p {
      margin: 0;
      margin-bottom: var(--layout-gap-xs);
    }
  }

  > .trigger {
    margin-top: var(--layout-gap-sm);
    @include buttons.secondary($padding: false);
  }
}

.listing-description-overlay {
  > .panel {
    @extend %overlay-panel;
    padding: var(--layout-gap-4xl);
    padding-bottom: calc(var(--layout-gap) * 2) !important;
    min-height: 0;
    overflow: hidden;

    > h2 {
      flex: 0 0 auto;
    }

    > .content {
      display: block;
      flex: 1 1 auto;
      min-height: 0;
      margin-bottom: 0;
      padding-bottom: var(--layout-gap);
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
      overflow-wrap: anywhere;
      word-break: break-word;

      > span {
        @include base-text($thin: false);
      }

      h3 {
        margin-top: var(--layout-gap-sm) !important;
        margin-bottom: var(--layout-gap-xs) !important;
        @include h4-title;
      }

      h2 {
        margin-top: var(--layout-gap-sm) !important;
        margin-bottom: var(--layout-gap-xs) !important;
        @include h3-title;
      }

      p {
        margin: 0;
        margin-bottom: var(--layout-gap-xs);
      }
    }

    > .close {
      position: absolute;
      top: var(--layout-gap-md);
      right: var(--layout-gap-md);

      > .button {
        @include buttons.primary($padding: false, $theme: white);
      }
    }
  }
}
</style>
