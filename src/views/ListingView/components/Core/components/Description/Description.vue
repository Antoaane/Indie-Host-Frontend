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
      class="preview"
      v-html="data.description"
    />

    <div class="trigger">
      <button
        type="button"
        :aria-expanded="isOpen"
        :aria-controls="'listing-description-dialog'"
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
              @click="closePopup"
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
    margin-bottom: var(--layout-gap-md) !important;
    @include h2-title($gradiant: true);
  }

  > .preview {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 7;
    /* Nombre de lignes visibles */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: normal;

    > span {
      @include base-text($thin: false);
    }

    h3 {
      margin-top: var(--layout-gap-md) !important;
      @include h4-title;
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
    @include layout-gap(padding, all, 2);
    padding-bottom: calc(var(--layout-gap) * 2) !important;

    > .content {
      margin-bottom: var(--layout-gap);

      h2 {
        @include h2-title;
      }

      h3 {
        margin-top: var(--layout-gap-md) !important;
        @include h4-title;
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
