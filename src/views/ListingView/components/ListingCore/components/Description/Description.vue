<!-- File: src/views/ListingView/components/ListingCore/components/Description/Description.vue -->

<script setup lang="ts">
// ASSETS
import { X } from 'lucide-vue-next'
// VUE
import { ref, onMounted, onBeforeUnmount } from 'vue'
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
  lockScroll()
}
function closePopup() {
  if (!isOpen.value) return
  isOpen.value = false
  unlockScroll()
}

/* ---------- helpers ---------- */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePopup()
}

function lockScroll() {
  document.documentElement.style.overflow = 'hidden'
}
function unlockScroll() {
  document.documentElement.style.overflow = ''
}

/* ---------- lifecycle ---------- */
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  unlockScroll()
})
</script>

<template>
  <div class="description-listing__comp">
    <h2>
      {{ staticContent.title }}
    </h2>

    <p v-html="data.brief" />

    <div class="description__trigger">
      <button
        type="button"
        :aria-expanded="isOpen"
        :aria-controls="'listing-description-dialog'"
        v-html="staticContent.ctaLabel"
        @click="openPopup"
      />
    </div>

    <!-- Transition wrapper -->
    <transition name="fade">
      <div
        v-if="isOpen"
        :data-popup="isOpen"
        class="backdrop"
        role="dialog"
        aria-modal="true"
        :aria-hidden="!isOpen"
        id="listing-description-dialog"
        @click.self="closePopup"
      >
        <transition name="fade-content">
          <div
            v-if="isOpen"
            class="display__description-blocks"
            @click.stop
          >
            <div class="close-container">
              <div class="close-btn">
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
            <div class="block">
              <p v-html="data.brief" />
            </div>
            <div
              v-for="block in data.blocks"
              :key="block.title"
              class="block"
            >
              <h3 v-html="block.title" />
              <p v-html="block.content" />
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/Description/description.scss';

/* Transition - backdrop fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Transition - content fade with slight scale */
.fade-content-enter-active,
.fade-content-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.fade-content-enter-from,
.fade-content-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
