<!-- File: src/views/Editor/components/EditorSidebar/EditorSection.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import { editorSectionDomId, type EditorSectionId } from '@/views/Editor/components/EditorSidebar/editorSections'

// Ancre d'un panneau dans le sommaire : la barre latérale fait défiler jusqu'ici et
// surligne la section visible.
const props = defineProps<{
  section: EditorSectionId
}>()

const domId = computed(() => editorSectionDomId(props.section))
</script>

<template>
  <div
    :id="domId"
    class="editor-section"
    :data-section="props.section"
  >
    <slot />
  </div>
</template>

<style lang="scss">
.editor-section {
  min-width: 0;
  // Le défilement vers une section laisse la marge du sommaire au-dessus du panneau.
  scroll-margin-top: var(--editor-section-scroll-margin, 0px);
}
</style>
