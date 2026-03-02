<!-- File: src/views/CreateListing/components/panels/inputs/CreateListingNumberStepper.vue -->

<script setup lang="ts">
import { computed } from 'vue'

type NumberStepperVariant = 'default' | 'hero'
type NumericInputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'

const props = withDefaults(
  defineProps<{
    value: string | number | null | undefined
    suffix?: string
    variant?: NumberStepperVariant
    min?: number | string
    max?: number | string
    step?: number | string
    inputmode?: NumericInputMode
    disabled?: boolean
    decrementDisabled?: boolean
    incrementDisabled?: boolean
    valueWidth?: string
    disableArrowKeys?: boolean
    disableWheel?: boolean
    decrementAriaLabel?: string
    incrementAriaLabel?: string
    decrementTitle?: string
    incrementTitle?: string
  }>(),
  {
    suffix: '',
    variant: 'default',
    step: 1,
    inputmode: 'numeric',
    disabled: false,
    decrementDisabled: false,
    incrementDisabled: false,
    valueWidth: '',
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
  'create-listing-number-stepper',
  `create-listing-number-stepper--${props.variant}`,
  {
    'create-listing-number-stepper--with-suffix': Boolean(props.suffix),
  },
])

const stepperStyle = computed(() =>
  props.valueWidth
    ? {
        '--create-listing-number-stepper-value-width': props.valueWidth,
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
@use '@/styles/components/inputs' as inputs;

.create-listing-number-stepper {
  @include inputs.stepper($theme: base);

  > .value {
    width: var(--create-listing-number-stepper-value-width, 3.5rem);
  }

  > .suffix {
    font-size: 0.8rem;
    color: rgba($secondary, 0.6);
    white-space: nowrap;
  }
}

.create-listing-number-stepper--hero {
  > .value {
    width: var(--create-listing-number-stepper-value-width, 5ch);
    font-size: 5rem;
    line-height: 1;
  }
}
</style>
