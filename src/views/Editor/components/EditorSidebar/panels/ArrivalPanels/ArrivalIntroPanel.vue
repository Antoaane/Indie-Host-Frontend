<!-- File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalIntroPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawArrival } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

const props = defineProps<{
  arrival?: Partial<RawArrival> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const panelContent = editorStatic.panels.arrival.intro
const intro = computed(() => props.arrival?.intro ?? { title: '', subtitle: '', tagline: '' })

function updateIntro(patch: Partial<NonNullable<RawArrival['intro']>>) {
  emit('patch', {
    arrival: {
      intro: {
        ...intro.value,
        ...patch,
      },
    },
  })
}
</script>

<template>
  <section class="editor-arrival-intro-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="input">
        <label>{{ panelContent.fields.title.label }}</label>
        <div class="field">
          <input
            type="text"
            :value="intro.title"
            :placeholder="panelContent.fields.title.placeholder"
            @input="updateIntro({ title: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
      <div class="input">
        <label>{{ panelContent.fields.subtitle.label }}</label>
        <div class="field">
          <textarea
            rows="3"
            :value="intro.subtitle"
            :placeholder="panelContent.fields.subtitle.placeholder"
            @input="updateIntro({ subtitle: ($event.target as HTMLTextAreaElement).value })"
          />
        </div>
      </div>
      <div class="input">
        <label>{{ panelContent.fields.tagline.label }}</label>
        <div class="field">
          <input
            type="text"
            :value="intro.tagline"
            :placeholder="panelContent.fields.tagline.placeholder"
            @input="updateIntro({ tagline: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/arrival-intro-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-arrival-intro-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .input {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;

      > label {
        display: block;
        @include little-text($color: rgba($secondary, 0.7), $bold: true, $thin: false);
        text-transform: uppercase;
        letter-spacing: 0.04rem;
      }

      > .field {
        @include inputs.field($theme: base);

        > textarea {
          min-height: 5rem;
          resize: vertical;
        }
      }
    }
  }
}
</style>
