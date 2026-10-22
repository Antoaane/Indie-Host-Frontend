<!-- File: src/components/inputs/NumberStepper.vue -->

<script setup lang="ts">
import { computed } from 'vue'

type InputTheme = 'base' | 'accent'
type NumericInputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'

const props = withDefaults(
  defineProps<{
    value: string | number | null | undefined
    suffix?: string
    theme?: InputTheme
    compact?: boolean
    min?: number | string
    max?: number | string
    step?: number | string
    inputmode?: NumericInputMode
    disabled?: boolean
    decrementDisabled?: boolean
    incrementDisabled?: boolean
    valueWidth?: string
    placeholder?: string
    disableArrowKeys?: boolean
    disableWheel?: boolean
    decrementAriaLabel?: string
    incrementAriaLabel?: string
    decrementTitle?: string
    incrementTitle?: string
  }>(),
  {
    suffix: '',
    theme: 'base',
    compact: false,
    step: 1,
    inputmode: 'numeric',
    disabled: false,
    decrementDisabled: false,
    incrementDisabled: false,
    valueWidth: '',
    placeholder: '',
    disableArrowKeys: false,
    disableWheel: false,
    decrementAriaLabel: '',
    incrementAriaLabel: '',
    decrementTitle: '',
    incrementTitle: '',
  },
)

const emit = defineEmits<{
  (e: 'decrement'): void
  (e: 'increment'): void
  (e: 'input', payload: { raw: string; number: number }): void
}>()

const stepperClasses = computed(() => [
  'ui-number-stepper',
  `ui-number-stepper--theme-${props.theme}`,
  {
    'ui-number-stepper--compact': props.compact,
    'ui-number-stepper--with-suffix': Boolean(props.suffix),
  },
])

const stepperStyle = computed(() =>
  props.valueWidth
    ? {
        '--ui-number-stepper-value-width': props.valueWidth,
      }
    : undefined,
)

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  emit('input', {
    raw: target.value,
    number: target.valueAsNumber,
  })
}

function onKeydown(event: KeyboardEvent) {
  if (!props.disableArrowKeys) return
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
  }
}

function onWheel(event: WheelEvent) {
  if (!props.disableWheel) return
  event.preventDefault()
}
</script>

<template>
  <div
    :class="stepperClasses"
    :style="stepperStyle"
  >
    <div class="btn">
      <button
        type="button"
        :disabled="props.disabled || props.decrementDisabled"
        :aria-label="props.decrementAriaLabel || undefined"
        :title="props.decrementTitle || undefined"
        @click="emit('decrement')"
      >
        <slot name="decrement">−</slot>
      </button>
    </div>

    <input
      class="value"
      type="number"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      :inputmode="props.inputmode"
      :disabled="props.disabled"
      :value="props.value ?? ''"
      :placeholder="props.placeholder"
      @input="onInput"
      @keydown="onKeydown"
      @wheel="onWheel"
    />

    <span
      v-if="props.suffix"
      class="suffix"
    >
      {{ props.suffix }}
    </span>

    <div class="btn">
      <button
        type="button"
        :disabled="props.disabled || props.incrementDisabled"
        :aria-label="props.incrementAriaLabel || undefined"
        :title="props.incrementTitle || undefined"
        @click="emit('increment')"
      >
        <slot name="increment">+</slot>
      </button>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

.ui-number-stepper {
  --ui-stepper-text: #{$secondary-text};
  --ui-stepper-bg: #{$tertiary};
  --ui-stepper-border: #{rgba($secondary-text, 0.1)};
  --ui-stepper-shadow: #{rgba($secondary-text, 0.08)};
  --ui-stepper-btn-bg: #{$accent};
  --ui-stepper-btn-bg-hover: #{$secondary};
  --ui-stepper-btn-text: #{$secondary};
  --ui-stepper-btn-text-hover: #{$accent};
  --ui-stepper-btn-size: 36px;
  --ui-stepper-btn-min-height: 18px;
  --ui-stepper-value-min-height: 36px;

  width: max-content;
  display: inline-grid;
  grid-template-columns: auto auto;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  column-gap: var(--layout-gap-xs);
  row-gap: 0;
  align-items: stretch;

  > .btn {
    grid-column: 1;

    > button {
      width: var(--ui-stepper-btn-size);
      height: 100%;
      min-height: var(--ui-stepper-btn-min-height);
      padding: 0;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0;

      cursor: pointer;
      border: none;
      border-radius: borders.$rounded-sm;
      background: var(--ui-stepper-btn-bg);
      color: var(--ui-stepper-btn-text);
      font-size: 0.95rem;
      font-weight: 700;
      line-height: 1;
      @include animations.transition(animations.$duration-fast);
      @include animations.press();

      > * {
        color: var(--ui-stepper-btn-text);
        stroke: var(--ui-stepper-btn-text);
        @include animations.transition(animations.$duration-fast);
      }

      &:disabled,
      &[aria-disabled='true'] {
        cursor: not-allowed;
        opacity: 0.55;
      }

      @include on-hover(':not(:disabled):not([aria-disabled="true"])') {
        background: var(--ui-stepper-btn-bg-hover);
        color: var(--ui-stepper-btn-text-hover);
        box-shadow: 0px 10px 20px -5px rgba(0, 0, 0, 0.15);

        > * {
          color: var(--ui-stepper-btn-text-hover);
          stroke: var(--ui-stepper-btn-text-hover);
        }
      }
    }
  }

  > .btn:first-of-type {
    grid-row: 2;
  }

  > .btn:last-of-type {
    grid-row: 1;
  }

  > .value {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: stretch;

    width: var(--ui-number-stepper-value-width, 3.5rem);
    flex: 0 0 auto;
    min-height: var(--ui-stepper-value-min-height);
    height: 100%;

    box-sizing: border-box;
    border: 1px solid var(--ui-stepper-border);
    border-radius: borders.$rounded-md;
    background-color: var(--ui-stepper-bg);
    box-shadow: 0 1px 3px var(--ui-stepper-shadow);
    color: var(--ui-stepper-text);

    text-align: center;
    font-family: 'Outfit', sans-serif;
    font-size: 1rem;
    line-height: 1.2;
    outline: none;
  }

  > .suffix {
    grid-column: 3;
    grid-row: 1 / span 2;
    align-self: center;
    font-size: 0.8rem;
    color: rgba($secondary, 0.6);
    white-space: nowrap;
  }
}

.ui-number-stepper--theme-base {
  --ui-stepper-text: #{$secondary-text};
  --ui-stepper-bg: #{$tertiary};
  --ui-stepper-border: #{rgba($secondary-text, 0.1)};
  --ui-stepper-shadow: #{rgba($secondary-text, 0.08)};
}

.ui-number-stepper--theme-base.ui-number-stepper--compact {
  --ui-stepper-btn-size: 32px;
  --ui-stepper-btn-min-height: 16px;
  --ui-stepper-value-min-height: 32px;
}

.ui-number-stepper--theme-accent {
  --ui-stepper-text: #{$secondary-text};
  --ui-stepper-bg: #{$accent};
  --ui-stepper-border: #{rgba($secondary-text, 0.08)};
  --ui-stepper-shadow: #{rgba($secondary-text, 0.06)};
}

.ui-number-stepper--theme-accent.ui-number-stepper--compact {
  --ui-stepper-btn-size: 32px;
  --ui-stepper-btn-min-height: 16px;
  --ui-stepper-value-min-height: 32px;
}

// Au doigt, deux demi-boutons empilés de 16 à 18 px sont inatteignables :
// on passe en ligne (− valeur +) avec des cibles de 44 px.
@media (pointer: coarse) {
  .ui-number-stepper {
    grid-template-rows: auto;

    > .btn > button {
      width: 44px;
      min-height: 44px;
    }

    > .btn:first-of-type {
      grid-row: 1;
      grid-column: 1;
    }

    > .value {
      grid-row: 1;
      grid-column: 2;
      min-height: 44px;
    }

    > .btn:last-of-type {
      grid-row: 1;
      grid-column: 3;
    }

    > .suffix {
      grid-row: 1;
      grid-column: 4;
    }
  }
}
</style>
