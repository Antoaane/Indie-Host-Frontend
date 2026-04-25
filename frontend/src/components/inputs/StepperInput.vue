<!-- File: src/components/inputs/StepperInput.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type InputTheme = 'base' | 'accent'
type NumericInputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'
type SuffixPlacement = 'inside' | 'outside'

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
    valueFontSize?: string
    suffixFontSize?: string
    autoWidth?: boolean
    suffixPlacement?: SuffixPlacement
    minDigits?: number
    maxDigits?: number
    widthPaddingCh?: number
    disableArrowKeys?: boolean
    disableWheel?: boolean
  }>(),
  {
    suffix: '',
    theme: 'base',
    compact: false,
    step: 1,
    inputmode: 'numeric',
    disabled: false,
    valueFontSize: '1.75rem',
    suffixFontSize: '1rem',
    autoWidth: true,
    suffixPlacement: 'inside',
    minDigits: 1,
    maxDigits: 5,
    widthPaddingCh: 0.2,
    disableArrowKeys: true,
    disableWheel: true,
  },
)

const emit = defineEmits<{
  (e: 'input', payload: { raw: string; number: number }): void
}>()

const measureRef = ref<HTMLSpanElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const measuredWidth = ref('')

const isSuffixOutside = computed(() => props.suffixPlacement === 'outside')
const measurementText = computed(() => resolveStepperInputMeasurementText(props.value))

const stepperClasses = computed(() => [
  'ui-stepper-input',
  `ui-stepper-input--theme-${props.theme}`,
  {
    'ui-stepper-input--compact': props.compact,
    'ui-stepper-input--suffix-outside': isSuffixOutside.value,
  },
])

const stepperStyle = computed(() => {
  const style: Record<string, string> = {
    '--ui-stepper-input-value-font-size': props.valueFontSize,
    '--ui-stepper-input-suffix-font-size': props.suffixFontSize,
  }

  if (props.autoWidth) {
    const baseWidth = measuredWidth.value || resolveStepperInputWidth(props.value)
    style['--stepper-input-width'] = `calc(${baseWidth} + ${props.widthPaddingCh}ch)`
  }

  return style
})

function resolveStepperInputWidth(value: unknown): string {
  return `${resolveStepperInputCharacterCount(value)}ch`
}

function resolveStepperInputCharacterCount(value: unknown): number {
  const raw = `${value ?? ''}`.trim()
  const digitCount = Math.max(1, (raw.match(/\d/g) ?? []).length)
  const minDigits = Math.max(1, props.minDigits)
  const maxDigits = Math.max(minDigits, props.maxDigits)
  const boundedDigits = Math.min(maxDigits, Math.max(minDigits, digitCount))
  const hasSign = raw.startsWith('-') ? 1 : 0
  const hasDecimalSeparator = /[.,]/.test(raw) ? 1 : 0
  return boundedDigits + hasSign + hasDecimalSeparator
}

function resolveStepperInputMeasurementText(value: unknown): string {
  const raw = `${value ?? ''}`.trim()
  const hasSign = raw.startsWith('-')
  const hasDecimalSeparator = /[.,]/.test(raw)
  const digitCount = resolveStepperInputCharacterCount(value) - (hasSign ? 1 : 0) - (hasDecimalSeparator ? 1 : 0)
  return `${hasSign ? '-' : ''}${'0'.repeat(Math.max(1, digitCount))}${hasDecimalSeparator ? '.' : ''}`
}

async function refreshMeasuredWidth() {
  if (!props.autoWidth) {
    measuredWidth.value = ''
    return
  }

  await nextTick()
  const measureElement = measureRef.value
  const inputElement = inputRef.value
  if (!measureElement || !inputElement) return

  const inputStyle = window.getComputedStyle(inputElement)
  measureElement.style.font = inputStyle.font
  measureElement.style.fontVariantNumeric = inputStyle.fontVariantNumeric
  measureElement.style.letterSpacing = inputStyle.letterSpacing

  const width = Math.ceil(measureElement.getBoundingClientRect().width)
  measuredWidth.value = `${Math.max(1, width)}px`
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

let measureObserver: ResizeObserver | null = null

onMounted(() => {
  void refreshMeasuredWidth()

  if (typeof ResizeObserver !== 'undefined' && measureRef.value) {
    measureObserver = new ResizeObserver(() => {
      void refreshMeasuredWidth()
    })
    measureObserver.observe(measureRef.value)
  }
})

onBeforeUnmount(() => {
  if (!measureObserver) return
  measureObserver.disconnect()
  measureObserver = null
})

watch([measurementText, () => props.autoWidth], () => {
  void refreshMeasuredWidth()
}, { immediate: true })
</script>

<template>
  <div
    :class="stepperClasses"
    :style="stepperStyle"
  >
    <template v-if="isSuffixOutside">
      <div class="field">
        <input
          ref="inputRef"
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
      </div>
      <span
        v-if="props.suffix"
        class="suffix suffix--outside"
      >
        {{ props.suffix }}
      </span>
    </template>
    <template v-else>
      <input
        ref="inputRef"
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
        class="suffix suffix--inside"
      >
        {{ props.suffix }}
      </span>
    </template>
    <span
      ref="measureRef"
      class="value-measure"
      aria-hidden="true"
    >
      {{ measurementText }}
    </span>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.ui-stepper-input {
  --ui-stepper-input-text: #{$secondary-text};
  --ui-stepper-input-hover-bg: #{rgba($secondary-text, 0.06)};
  --ui-stepper-input-focus-bg: #{rgba($secondary-text, 0.09)};
  --ui-stepper-input-disabled-text: #{rgba($secondary-text, 0.48)};
  --ui-stepper-input-suffix-color: #{rgba($secondary-text, 0.62)};
  --ui-stepper-input-min-height: 2.75rem;

  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  justify-self: start;
  align-self: flex-start;
  position: relative;
  width: fit-content;
  max-width: 100%;
  gap: calc(var(--ui-stepper-input-suffix-font-size) * 0.4);
  min-height: var(--ui-stepper-input-min-height);
  padding-inline: calc(var(--ui-stepper-input-suffix-font-size) * 0.75);
  border-radius: borders.$rounded-md;
  background-color: transparent;
  transition: all 200ms cubic-bezier(0.6, 0, 0.3, 1);

  &:hover {
    background-color: var(--ui-stepper-input-hover-bg);
  }

  &:focus-within {
    background-color: var(--ui-stepper-input-focus-bg);
  }

  > .field {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    width: fit-content;
    max-width: 100%;
    min-height: var(--ui-stepper-input-min-height);
    padding-inline: calc(var(--ui-stepper-input-suffix-font-size) * 0.75);
    border-radius: borders.$rounded-md;
    background-color: transparent;
    transition: all 200ms cubic-bezier(0.6, 0, 0.3, 1);
  }

  > .value,
  > .field > .value {
    width: var(--stepper-input-width, 6ch);
    flex: 0 0 auto;
    height: max-content;
    min-height: var(--ui-stepper-input-min-height);

    border: none;
    border-radius: 0;
    background-color: transparent;
    box-shadow: none;
    box-sizing: border-box;
    outline: none;

    text-align: right;
    padding: 0;
    color: var(--ui-stepper-input-text);
    font-family: 'Outfit', sans-serif;
    font-size: var(--ui-stepper-input-value-font-size, 1.75rem);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;

    appearance: textfield;
    -moz-appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    &:disabled {
      cursor: not-allowed;
      color: var(--ui-stepper-input-disabled-text);
    }
  }

  > .value-measure {
    position: absolute;
    left: 0;
    top: 0;
    visibility: hidden;
    pointer-events: none;
    white-space: pre;
    padding: 0;
    font-family: 'Outfit', sans-serif;
    font-size: var(--ui-stepper-input-value-font-size, 1.75rem);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  > .suffix {
    margin-left: 0.28rem;
    white-space: nowrap;
    color: var(--ui-stepper-input-suffix-color);
    font-size: var(--ui-stepper-input-suffix-font-size, 1rem);
  }
}

.ui-stepper-input--suffix-outside {
  min-height: auto;
  padding-inline: 0;
  background-color: transparent;

  &:hover {
    background-color: transparent;
  }

  &:focus-within {
    background-color: transparent;
  }

  > .field:hover {
    background-color: var(--ui-stepper-input-hover-bg);
  }

  &:focus-within > .field {
    background-color: var(--ui-stepper-input-focus-bg);
  }

  > .suffix--outside {
    margin-left: 0;
  }
}

.ui-stepper-input--theme-base {
  --ui-stepper-input-text: #{$secondary-text};
  --ui-stepper-input-hover-bg: #{rgba($secondary-text, 0.06)};
  --ui-stepper-input-focus-bg: #{rgba($secondary-text, 0.09)};
  --ui-stepper-input-disabled-text: #{rgba($secondary-text, 0.48)};
  --ui-stepper-input-suffix-color: #{rgba($secondary-text, 0.62)};
}

.ui-stepper-input--theme-base.ui-stepper-input--compact {
  --ui-stepper-input-min-height: 2.4rem;
}

.ui-stepper-input--theme-accent {
  --ui-stepper-input-text: #{$secondary-text};
  --ui-stepper-input-hover-bg: #{rgba($secondary-text, 0.06)};
  --ui-stepper-input-focus-bg: #{rgba($secondary-text, 0.09)};
  --ui-stepper-input-disabled-text: #{rgba($secondary-text, 0.48)};
  --ui-stepper-input-suffix-color: #{rgba($secondary-text, 0.62)};
}

.ui-stepper-input--theme-accent.ui-stepper-input--compact {
  --ui-stepper-input-min-height: 2.4rem;
}
</style>
