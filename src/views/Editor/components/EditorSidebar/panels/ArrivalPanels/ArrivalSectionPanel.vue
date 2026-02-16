<!-- File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalSectionPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawArrival } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

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

function isLockedField(fieldKey: string): boolean {
  return lockedFieldKeySet.value.has(fieldKey.trim())
}

function updateField(fieldKey: string, value: string) {
  if (isLockedField(fieldKey)) return

  const practicalPatch = {
    [props.sectionKey]: {
      [fieldKey]: value,
    },
  } as Partial<RawArrival['practical']>

  emit('patch', {
    arrival: { practical: practicalPatch } as Partial<RawArrival>,
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
            :readonly="isLockedField(field.key)"
            :disabled="isLockedField(field.key)"
            @input="updateField(field.key, ($event.target as HTMLInputElement).value)"
          />
        </div>
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
        text-transform: uppercase;
        letter-spacing: 0.04rem;
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
    }
  }
}
</style>
