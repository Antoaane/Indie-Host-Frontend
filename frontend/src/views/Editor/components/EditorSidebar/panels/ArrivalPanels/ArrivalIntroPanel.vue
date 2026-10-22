<!-- File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalIntroPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawArrival } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import {
  formatValidationMessage,
  normalizeTextInput,
  resolveTextMaxLength,
  shouldDisplayTextLimit,
} from '@/utils/inputValidation'

const props = defineProps<{
  arrival?: Partial<RawArrival> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const panelContent = editorStatic.panels.arrival.intro
const intro = computed(() => props.arrival?.intro ?? { title: '', subtitle: '', tagline: '' })
const introLimits = editorStatic.validation.arrival
const textDefaults = editorStatic.validation.defaults.simpleText
const titleMaxLength = resolveTextMaxLength(introLimits.titleMax, textDefaults)
const taglineMaxLength = resolveTextMaxLength(introLimits.taglineMax, textDefaults)
const showTitleCounter = shouldDisplayTextLimit(titleMaxLength, textDefaults)
const showTaglineCounter = shouldDisplayTextLimit(taglineMaxLength, textDefaults)
const titleLength = computed(() => Math.min(String(intro.value.title ?? '').length, titleMaxLength))
const subtitleLength = computed(() => Math.min(String(intro.value.subtitle ?? '').length, introLimits.subtitleMax))
const taglineLength = computed(() => Math.min(String(intro.value.tagline ?? '').length, taglineMaxLength))
const titleCounter = computed(() =>
  formatValidationMessage(introLimits.messages.counter, {
    current: titleLength.value,
    max: titleMaxLength,
  }),
)
const subtitleCounter = computed(() =>
  formatValidationMessage(introLimits.messages.counter, {
    current: subtitleLength.value,
    max: introLimits.subtitleMax,
  }),
)
const taglineCounter = computed(() =>
  formatValidationMessage(introLimits.messages.counter, {
    current: taglineLength.value,
    max: taglineMaxLength,
  }),
)

function updateIntro(patch: Partial<NonNullable<RawArrival['intro']>>) {
  const sanitizedPatch = {
    ...(typeof patch.title === 'string' ? { title: normalizeTextInput(patch.title, titleMaxLength) } : {}),
    ...(typeof patch.subtitle === 'string' ? { subtitle: normalizeTextInput(patch.subtitle, introLimits.subtitleMax) } : {}),
    ...(typeof patch.tagline === 'string' ? { tagline: normalizeTextInput(patch.tagline, taglineMaxLength) } : {}),
  }

  emit('patch', {
    arrival: {
      intro: {
        ...intro.value,
        ...sanitizedPatch,
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
            :maxlength="titleMaxLength"
            autocomplete="off"
            inputmode="text"
            @input="updateIntro({ title: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <p
          v-if="showTitleCounter"
          class="meta"
        >
          {{ titleCounter }}
        </p>
      </div>
      <div class="input">
        <label>{{ panelContent.fields.subtitle.label }}</label>
        <div class="field">
          <textarea
            rows="3"
            :value="intro.subtitle"
            :placeholder="panelContent.fields.subtitle.placeholder"
            :maxlength="introLimits.subtitleMax"
            autocomplete="off"
            @input="updateIntro({ subtitle: ($event.target as HTMLTextAreaElement).value })"
          />
        </div>
        <p class="meta">{{ subtitleCounter }}</p>
      </div>
      <div class="input">
        <label>{{ panelContent.fields.tagline.label }}</label>
        <div class="field">
          <input
            type="text"
            :value="intro.tagline"
            :placeholder="panelContent.fields.tagline.placeholder"
            :maxlength="taglineMaxLength"
            autocomplete="off"
            inputmode="text"
            @input="updateIntro({ tagline: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <p
          v-if="showTaglineCounter"
          class="meta"
        >
          {{ taglineCounter }}
        </p>
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
      }

      > .field {
        @include inputs.field($theme: base);

        > textarea {
          min-height: 5rem;
          resize: vertical;
        }
      }

      > .meta {
        margin: 0;
        @include little-text($color: rgba($secondary, 0.62), $thin: false);
      }
    }
  }
}
</style>
