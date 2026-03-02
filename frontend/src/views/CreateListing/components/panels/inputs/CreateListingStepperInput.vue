<!-- File: src/views/CreateListing/components/panels/inputs/CreateListingStepperInput.vue -->

<script setup lang="ts">
import { computed } from 'vue'

type StepperInputVariant = 'default' | 'hero'
type NumericInputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'

const props = withDefaults(
  defineProps<{
    value: string | number | null | undefined
    suffix?: string
    variant?: StepperInputVariant
    min?: number | string
    max?: number | string
    step?: number | string
    inputmode?: NumericInputMode
    disabled?: boolean
    autoWidth?: boolean
    minWidthCh?: number
    widthPaddingCh?: number
    disableArrowKeys?: boolean
    disableWheel?: boolean
  }>(),
  {
    suffix: '',
    variant: 'default',
    step: 1,
    inputmode: 'numeric',
    disabled: false,
    autoWidth: true,
    minWidthCh: 2.25,
    widthPaddingCh: 0.45,
    disableArrowKeys: true,
    disableWheel: true,
  },
)

const emit = defineEmits<{
  (e: 'input', payload: { raw: string; number: number }): void
}>()

const stepperClasses = computed(() => [
  'create-listing-stepper-input',
  `create-listing-stepper-input--${props.variant}`,
])

const stepperStyle = computed(() => {
  if (!props.autoWidth) return undefined
  return {
    '--stepper-input-width': resolveStepperInputWidth(props.value),
  }
})

function resolveStepperInputWidth(value: unknown): string {
  const raw = `${value ?? ''}`.trim()
  const chars = Math.max(1, raw.length)
  return `${Math.max(props.minWidthCh, chars + props.widthPaddingCh)}ch`
}

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
  </div>
</template>

<style lang="scss">
@use '@/styles/components/inputs' as inputs;

.create-listing-stepper-input {
  @include inputs.stepper-input($theme: base);
}

.create-listing-stepper-input--hero {
  @include inputs.stepper-input($theme: base, $value-font-size: 5rem, $suffix-font-size: 2rem);
}
</style>
