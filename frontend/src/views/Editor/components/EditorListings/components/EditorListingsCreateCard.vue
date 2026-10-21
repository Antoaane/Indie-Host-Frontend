<!-- File: src/views/Editor/components/EditorListings/components/EditorListingsCreateCard.vue -->

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  to: RouteLocationRaw
  title: string
  activeUsage: string
  remainingDisplay: string
  isLimitReached: boolean
  /** Action proposée quand la limite du plan est atteinte (choisir un plan / ajouter un logement). */
  limitCtaLabel?: string | null
  isLimitCtaBusy?: boolean
  limitCtaError?: string | null
}>()

const emit = defineEmits<{
  (e: 'limit-cta'): void
}>()
</script>

<template>
  <div class="new-card">
    <RouterLink :to="props.to">
      <div class="content">
        <span>{{ props.title }}</span>
        <small class="usage">{{ props.activeUsage }}</small>
        <small
          class="remaining"
          :class="{ 'is-limit-reached': props.isLimitReached }"
        >
          {{ props.remainingDisplay }}
        </small>
      </div>
    </RouterLink>

    <div
      v-if="props.isLimitReached && props.limitCtaLabel"
      class="limit-cta"
    >
      <button
        type="button"
        :disabled="props.isLimitCtaBusy"
        @click="emit('limit-cta')"
      >
        {{ props.limitCtaLabel }}
      </button>
      <p
        v-if="props.limitCtaError"
        class="limit-cta-error"
        role="alert"
      >
        {{ props.limitCtaError }}
      </p>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;

.new-card > .limit-cta {
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-xs);
  padding: 0 var(--layout-gap-sm) var(--layout-gap-sm);

  @include buttons.primary($theme: dark, $fullwidth: true, $little: true);

  > .limit-cta-error {
    margin: 0;
    @include little-text($thin: false);
    color: rgba($bad, 0.95);
  }
}
</style>
