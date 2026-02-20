<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/TitlePanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { formatValidationMessage, normalizeTextInput } from '@/utils/inputValidation'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const titleValidation = editorStatic.validation.listing.title

const title = computed({
  get: () => props.core?.title ?? '',
  set: (value: string) => {
    const next = normalizeTextInput(value, titleValidation.max)
    if (next === (props.core?.title ?? '')) return
    emit('patch', { core: { title: next } })
  },
})

const titleLength = computed(() => title.value.length)
const titleError = computed(() => {
  if (!titleLength.value) return ''
  if (titleLength.value < titleValidation.min) {
    return formatValidationMessage(titleValidation.messages.min, { min: titleValidation.min })
  }
  return ''
})

const panelContent = editorStatic.panels.listing.title
const titleCounter = computed(() =>
  formatValidationMessage(titleValidation.messages.counter, {
    current: titleLength.value,
    max: titleValidation.max,
  }),
)
</script>

<template>
  <section class="editor-title-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="input">
        <input
          v-model="title"
          type="text"
          :placeholder="panelContent.placeholder"
          :maxlength="titleValidation.max"
          :minlength="titleValidation.min"
          inputmode="text"
          autocomplete="off"
          :aria-invalid="Boolean(titleError)"
        />
      </div>
      <p
        class="meta"
        :class="{ 'is-error': titleError }"
      >
        {{ titleError || titleCounter }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/title-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-title-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .input {
      @include inputs.field($theme: base);
    }

    > .meta {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.7);

      &.is-error {
        color: #b3261e;
      }
    }
  }
}
</style>
