<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/HubPagePanel.vue -->

<!-- Page principale : sa présentation (textes, photos, thème, sections) ne se remplit pas dans un
     formulaire, elle se modifie directement sur la page (`views/ListingHub/edit/`). Ce panneau y mène. -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Pencil } from 'lucide-vue-next'

import { editorStatic } from '@/views/Editor/utils/editorContent'

const props = defineProps<{
  listingId: string
  /** Propriétaire de la page quand un admin édite au nom d'un client : sert au retour vers son éditeur. */
  ownerId?: string | null
}>()

const content = editorStatic.panels.listing.hubPage
const route = useRoute()

function readParam(value: unknown): string {
  if (Array.isArray(value)) return readParam(value[0])
  return typeof value === 'string' ? value.trim() : ''
}

const editRoute = computed(() => {
  const owner = (props.ownerId ?? '').trim() || readParam(route.params.userId)
  return {
    name: 'page-editor',
    params: { listingId: props.listingId },
    query: owner ? { owner } : undefined,
  }
})
</script>

<template>
  <section class="editor-hub-page-panel">
    <div class="header">
      <h3>{{ content.title }}</h3>
      <p>{{ content.subtitle }}</p>
    </div>

    <div class="body">
      <div class="open">
        <RouterLink :to="editRoute">
          <Pencil
            :size="18"
            aria-hidden="true"
          />
          {{ content.cta }}
        </RouterLink>
      </div>

      <p class="hint">{{ content.hint }}</p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/HubPagePanel.vue */
@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-hub-page-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .open {
      @include buttons.primary($theme: black, $fullwidth: true);
    }

    > .hint {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.72);
    }
  }
}
</style>
