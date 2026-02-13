<!-- File: src/components/overlays/ConfirmationDialog.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'

type ConfirmationLevel = 1 | 2

type ConfirmationTone = 'default' | 'danger'

const props = withDefaults(
  defineProps<{
    open: boolean
    level?: ConfirmationLevel
    title: string
    message?: string
    subject?: string
    actionLabel?: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: ConfirmationTone
    confirmWord?: string
    typingHint?: string
    typingLabel?: string
    typingPlaceholder?: string
    confirmDisabled?: boolean
    cancelDisabled?: boolean
    closeOnBackdrop?: boolean
    closeOnEscape?: boolean
    ariaLabel?: string
  }>(),
  {
    level: 1,
    message: '',
    subject: '',
    actionLabel: '',
    confirmLabel: 'Confirmer',
    cancelLabel: 'Annuler',
    tone: 'danger',
    confirmWord: 'supprimer',
    typingHint: '',
    typingLabel: '',
    typingPlaceholder: '',
    confirmDisabled: false,
    cancelDisabled: false,
    closeOnBackdrop: true,
    closeOnEscape: true,
    ariaLabel: '',
  },
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'close'): void
}>()

const typedValue = ref('')

const isLevelTwo = computed(() => props.level === 2)

function normalize(value: string) {
  return value.trim().toLowerCase()
}

const normalizedConfirmWord = computed(() => normalize(props.confirmWord))
const normalizedTypedValue = computed(() => normalize(typedValue.value))

const isTypedConfirmationValid = computed(() => {
  if (!isLevelTwo.value) return true
  return normalizedTypedValue.value === normalizedConfirmWord.value
})

const isConfirmDisabled = computed(() => props.confirmDisabled || !isTypedConfirmationValid.value)

const actionTargetLabel = computed(() => {
  const action = normalize(props.actionLabel)
  const subject = normalize(props.subject)

  if (action && subject) return `${action} ${subject}`
  if (action) return action
  if (subject) return subject
  return 'confirmer cette action'
})

const resolvedTypingHint = computed(() => {
  if (props.typingHint.trim()) return props.typingHint
  return `Tapez \"${props.confirmWord}\" pour ${actionTargetLabel.value}.`
})

const resolvedTypingLabel = computed(() => {
  if (props.typingLabel.trim()) return props.typingLabel
  return 'Confirmation écrite'
})

const resolvedTypingPlaceholder = computed(() => {
  if (props.typingPlaceholder.trim()) return props.typingPlaceholder
  return props.confirmWord
})

const resolvedAriaLabel = computed(() => (props.ariaLabel.trim() ? props.ariaLabel : props.title))

watch(
  () => props.open,
  () => {
    typedValue.value = ''
  },
)

function handleConfirm() {
  if (isConfirmDisabled.value) return
  emit('confirm')
}

function handleCancel() {
  if (props.cancelDisabled) return
  emit('cancel')
}
</script>

<template>
  <AbsoluteOverlay
    class="confirmation-dialog-overlay"
    :open="open"
    :aria-label="resolvedAriaLabel"
    :close-on-backdrop="closeOnBackdrop"
    :close-on-escape="closeOnEscape"
    @close="emit('close')"
  >
    <div class="panel">
      <div class="header">
        <p
          v-if="subject"
          class="subject"
        >
          {{ subject }}
        </p>
        <h2>{{ title }}</h2>
      </div>

      <div class="body">
        <p
          v-if="message"
          class="message"
        >
          {{ message }}
        </p>

        <div
          v-if="isLevelTwo"
          class="typed-confirmation"
        >
          <p class="hint">
            {{ resolvedTypingHint }}
          </p>

          <label class="field">
            <span class="field-label">{{ resolvedTypingLabel }}</span>
            <input
              v-model="typedValue"
              type="text"
              autocomplete="off"
              :placeholder="resolvedTypingPlaceholder"
            />
          </label>
        </div>
      </div>

      <div class="footer">
        <button
          type="button"
          class="cancel"
          :disabled="cancelDisabled"
          @click="handleCancel"
        >
          {{ cancelLabel }}
        </button>

        <button
          type="button"
          class="confirm"
          :class="{ 'is-danger': tone === 'danger' }"
          :disabled="isConfirmDisabled"
          @click="handleConfirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </AbsoluteOverlay>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;
@use '@/styles/components/inputs' as inputs;
@use '@/styles/components/overlays' as overlays;

.confirmation-dialog-overlay {
  >.panel {
    @extend %overlay-panel;
    max-height: max-content;
    gap: var(--layout-gap-sm);

    >.header {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;

      >.subject {
        margin: 0;
        color: rgba($secondary, 0.65);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        @include little-text($thin: false);
      }

      >h2 {
        margin: 0;
        @include h2-title;
      }
    }

    >.body {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-sm);

      >.message {
        margin: 0;
        @include base-text;
      }

      >.typed-confirmation {
        display: flex;
        flex-direction: column;
        gap: var(--layout-gap-xs);

        >.hint {
          margin: 0;
          color: rgba($secondary, 0.75);
          @include little-text($thin: false);
        }

        >.field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;

          >.field-label {
            @include little-text($thin: false);
          }

          @include inputs.field($theme: accent, $compact: true);
        }
      }
    }

    >.footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--layout-gap-sm);

      >.cancel {
        @include buttons.primary($theme: white);
      }

      >.confirm {
        @include buttons.primary($theme: dark);

        &.is-danger {
          &:hover:not(:disabled) {
            background-color: $bad !important;
            color: $accent !important;
            outline-color: rgba($bad, 0.35) !important;

            * {
              color: $accent !important;
              stroke: $accent !important;
            }
          }
        }
      }
    }
  }
}
</style>
