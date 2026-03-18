<!-- File: src/components/feedback/ImportLoadingState.vue -->

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label?: string
  progress: number
  title: string
  hint?: string | null
  tip?: string | null
  tone?: 'default' | 'inverted'
  compact?: boolean
}>(), {
  label: 'Import en cours',
  hint: null,
  tip: null,
  tone: 'default',
  compact: false,
})

const normalizedProgress = computed(() => Math.max(0, Math.min(100, Math.round(props.progress))))
</script>

<template>
  <section
    class="import-loading-state"
    :class="[
      `is-${props.tone}`,
      { 'is-compact': props.compact },
    ]"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="meta">
      <p>{{ props.label }}</p>
      <strong>{{ normalizedProgress }}%</strong>
    </div>

    <div
      class="track"
      role="progressbar"
      :aria-label="props.label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="normalizedProgress"
    >
      <span :style="{ width: `${normalizedProgress}%` }" />
    </div>

    <p class="title">{{ props.title }}</p>
    <p
      v-if="props.hint"
      class="hint"
    >
      {{ props.hint }}
    </p>
    <p
      v-if="props.tip"
      class="tip"
    >
      {{ props.tip }}
    </p>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.import-loading-state {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: borders.$rounded-lg;
  border: 1px solid rgba($secondary, 0.1);
  background: rgba($background, 0.03);
  color: $secondary-text;

  &.is-compact {
    padding: 0.8rem 0.9rem;
    gap: 0.45rem;
  }

  &.is-inverted {
    border-color: rgba($accent, 0.14);
    background: rgba($accent, 0.08);
    color: $accent;

    > .meta > p,
    > .hint,
    > .tip {
      color: rgba($accent, 0.78);
    }

    > .track {
      background: rgba($accent, 0.12);
    }

    > .track > span {
      background: linear-gradient(90deg, rgba($accent, 0.88) 0%, rgba($accent, 1) 100%);
    }
  }

  > .meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;

    > p,
    > strong {
      margin: 0;
    }

    > p {
      @include little-text($thin: false);
      color: rgba($secondary-text, 0.68);
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    > strong {
      font-size: 1rem;
      line-height: 1;
      font-weight: 800;
      color: $accent;
    }
  }

  > .track {
    width: 100%;
    height: 0.45rem;
    overflow: hidden;
    border-radius: 999px;
    background: rgba($secondary, 0.08);

    > span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba($secondary, 0.78) 0%, rgba($secondary, 0.98) 100%);
      transition: width 320ms ease;
    }
  }

  > .title,
  > .hint,
  > .tip {
    margin: 0;
  }

  > .title {
    font-size: 0.95rem;
    line-height: 1.35;
    font-weight: 700;
  }

  > .hint,
  > .tip {
    @include little-text($thin: false);
    line-height: 1.45;
  }

  > .hint {
    color: rgba($secondary-text, 0.7);
  }

  > .tip {
    color: rgba($secondary-text, 0.58);
  }
}
</style>
