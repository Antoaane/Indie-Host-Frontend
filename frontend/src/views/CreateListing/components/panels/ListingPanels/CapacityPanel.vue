<!-- File: src/views/CreateListing/components/panels/ListingPanels/CapacityPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import StepperInput from '@/components/inputs/StepperInput.vue'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage } from '@/utils/inputValidation'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const capacityValidation = editorStatic.validation.listing.capacity
const capacity = computed(() => clampInteger(props.core?.guest_capacity, capacityValidation.min, capacityValidation.max, capacityValidation.min))
const capacityHint = computed(() =>
  formatValidationMessage(capacityValidation.messages.hint, {
    min: capacityValidation.min,
    max: capacityValidation.max,
  }),
)
const capacitySuffix = computed(() => (capacity.value > 1 ? 'voyageurs maximum' : 'voyageur maximum'))
const panelContent = editorStatic.panels.listing.capacity
const atMin = computed(() => capacity.value <= capacityValidation.min)
const atMax = computed(() => capacity.value >= capacityValidation.max)

function setCapacity(next: number) {
  const normalized = clampInteger(next, capacityValidation.min, capacityValidation.max, capacityValidation.min)
  if (normalized === capacity.value) return
  emit('patch', { core: { guest_capacity: normalized } })
}

function decrement() { setCapacity(capacity.value - 1) }
function increment() { setCapacity(capacity.value + 1) }
</script>

<template>
  <section class="create-capacity-panel">
    <div class="header">
      <h2>{{ panelContent.title }}</h2>
      <h3>{{ panelContent.subtitle }}</h3>
    </div>

    <div class="body">
      <div class="counter-area">
        <div class="capacity-counter">
          <button
            type="button"
            class="counter-btn"
            :disabled="atMin"
            aria-label="Diminuer"
            @click="decrement"
          >
            <Minus :size="24" />
          </button>

          <StepperInput
            :value="capacity"
            :min="capacityValidation.min"
            :max="capacityValidation.max"
            value-font-size="clamp(4.5rem, 26vw, 8.5rem)"
            @input="setCapacity($event.number)"
          />

          <button
            type="button"
            class="counter-btn"
            :disabled="atMax"
            aria-label="Augmenter"
            @click="increment"
          >
            <Plus :size="24" />
          </button>
        </div>

        <p class="counter-label">{{ capacitySuffix }}</p>
      </div>

      <p class="hint">{{ capacityHint }}</p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/ListingPanels/capacity-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/views/CreateListing/components/panels/panel.scss' as *;

.create-capacity-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;
    align-items: center;

    > .counter-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--layout-gap-sm);

      > .capacity-counter {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--layout-gap-md);

        > .counter-btn {
          flex-shrink: 0;
          width: 54px;
          height: 54px;
          border-radius: borders.$rounded;
          border: 1px solid rgba($secondary, 0.2);
          background: transparent;
          color: rgba($secondary-text, 0.65);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          @include animations.transition(animations.$duration-fast);
          @include animations.press(0.95);

          @include on-hover(':not(:disabled)') {
            background: rgba($secondary, 0.06);
            border-color: rgba($secondary, 0.32);
            color: $secondary-text;
          }

          &:active:not(:disabled) {
            background: rgba($secondary, 0.11);
          }

          &:disabled {
            opacity: 0.25;
            cursor: not-allowed;
          }
        }

        // Centrage vertical du chiffre
        .ui-stepper-input {
          align-self: center;
          padding-inline: 0;

          > .value {
            text-align: center;
          }
        }
      }

      > .counter-label {
        margin: 0;
        text-align: center;
        @include base-text($thin: true);
        font-size: clamp(0.95rem, 3.5vw, 1.25rem);
        color: rgba($secondary-text, 0.48);
        letter-spacing: 0.015em;
      }
    }

    > .hint {
      margin: 0;
      text-align: center;
      @include little-text($thin: true);
      color: rgba($secondary-text, 0.42);
    }
  }

  @media screen and (max-width: 768px) {
    > .body {
      gap: var(--layout-gap-lg);

      > .counter-area > .capacity-counter {
        gap: var(--layout-gap-sm);

        > .counter-btn {
          width: 60px;
          height: 60px;
        }
      }
    }
  }
}
</style>
