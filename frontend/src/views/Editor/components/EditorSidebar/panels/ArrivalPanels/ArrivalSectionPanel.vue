<!-- File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalSectionPanel.vue -->

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

type TextSectionKey = 'savings' | 'access' | 'services'
type TextSectionValues = Record<string, string>
type TextFieldConfig = {
  key: string
  label: string
  placeholder?: string
}

const props = defineProps<{
  sectionKey: TextSectionKey
  title: string
  subtitle?: string
  fields: TextFieldConfig[]
  values?: Partial<TextSectionValues> | null
  lockedFieldKeys?: string[]
  lockedFieldHint?: string
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const resolvedValues = computed(() => props.values ?? {})
const lockedFieldKeySet = computed(() => new Set((props.lockedFieldKeys ?? []).map((key) => key.trim())))
const arrivalValidation = editorStatic.validation.arrival
const textDefaults = editorStatic.validation.defaults.simpleText
const fieldMaxLength = resolveTextMaxLength(arrivalValidation.practicalFieldMax, textDefaults)
const showFieldCounter = shouldDisplayTextLimit(fieldMaxLength, textDefaults)

function isLockedField(fieldKey: string): boolean {
  return lockedFieldKeySet.value.has(fieldKey.trim())
}

function updateField(fieldKey: string, value: string) {
  if (isLockedField(fieldKey)) return
  const next = normalizeTextInput(value, fieldMaxLength)
  if ((resolvedValues.value as Record<string, string>)[fieldKey] === next) return

  const practicalPatch = {
    [props.sectionKey]: {
      [fieldKey]: next,
    },
  } as Partial<RawArrival['practical']>

  emit('patch', {
    arrival: { practical: practicalPatch } as Partial<RawArrival>,
  })
}

function fieldCounter(fieldKey: string): string {
  const currentLength = Math.min(String((resolvedValues.value as Record<string, string>)[fieldKey] ?? '').length, fieldMaxLength)
  return formatValidationMessage(arrivalValidation.messages.counter, {
    current: currentLength,
    max: fieldMaxLength,
  })
}
</script>

<template>
  <section class="editor-arrival-section-panel">
    <div class="header">
      <h3>{{ props.title }}</h3>
      <p v-if="props.subtitle">{{ props.subtitle }}</p>
    </div>

    <div class="body">
      <div
        v-for="field in props.fields"
        :key="field.key"
        class="input"
      >
        <label>{{ field.label }}</label>
        <div class="field">
          <input
            type="text"
            :value="(resolvedValues as Record<string, string>)[field.key] ?? ''"
            :placeholder="field.placeholder || ''"
            :maxlength="fieldMaxLength"
            autocomplete="off"
            inputmode="text"
            :readonly="isLockedField(field.key)"
            :disabled="isLockedField(field.key)"
            @input="updateField(field.key, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <small
          v-if="showFieldCounter"
          class="meta"
        >
          {{ fieldCounter(field.key) }}
        </small>
        <small
          v-if="isLockedField(field.key) && props.lockedFieldHint"
          class="locked-hint"
        >
          {{ props.lockedFieldHint }}
        </small>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/arrival-section-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-arrival-section-panel {
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

        > input {
          height: 2.9rem;

          &:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }
        }
      }

      > .locked-hint {
        @include little-text($color: rgba($secondary, 0.62), $thin: false);
      }

      > .meta {
        @include little-text($color: rgba($secondary, 0.62), $thin: false);
      }
    }
  }
}
</style>
