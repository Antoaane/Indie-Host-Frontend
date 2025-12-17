<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebarNav.vue -->

<script setup lang="ts">
type SidebarTab = 'listing' | 'pricing' | 'arrival'

const props = defineProps<{
  modelValue: SidebarTab
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SidebarTab): void
}>()
</script>

<template>
  <nav class="editor-sidebar__tabs">
    <div
      class="editor-sidebar__tab"
      :class="{ 'is-active': props.modelValue === 'listing' }"
    >
      <button
        type="button"
        @click="emit('update:modelValue', 'listing')"
      >
        Annonce
      </button>
    </div>
    <div
      class="editor-sidebar__tab"
      :class="{ 'is-active': props.modelValue === 'pricing' }"
    >
      <button
        type="button"
        @click="emit('update:modelValue', 'pricing')"
      >
        Tarification
      </button>
    </div>
    <div
      class="editor-sidebar__tab"
      :class="{ 'is-active': props.modelValue === 'arrival' }"
    >
      <button
        type="button"
        @click="emit('update:modelValue', 'arrival')"
      >
        Arrivée
      </button>
    </div>
  </nav>
</template>
