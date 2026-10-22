<!-- File: src/views/Editor/components/EditorListings/components/EditorListingsCreateCard.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { LayoutGrid, Loader2, Plus } from 'lucide-vue-next'

const props = defineProps<{
  to: RouteLocationRaw
  title: string
  usageLabel: string
  activeCount: number
  /** Logements inclus + supplémentaires ; `Infinity` pour un admin (pas de jauge). */
  maxActive: number
  footnote: string
  isLimitReached: boolean
  /** Action proposée quand la limite du plan est atteinte (choisir un plan / ajouter un logement). */
  limitCtaLabel?: string | null
  isLimitCtaBusy?: boolean
  limitCtaError?: string | null
  /** Action secondaire : créer une page principale (annonce mère) qui présente les logements. */
  hubTitle?: string | null
  hubDescription?: string | null
  hubBusyLabel?: string | null
  isHubBusy?: boolean
}>()

const emit = defineEmits<{
  (e: 'limit-cta'): void
  (e: 'create-hub'): void
}>()

const hasLimit = computed(() => Number.isFinite(props.maxActive) && props.maxActive > 0)
const usageValue = computed(() => (hasLimit.value ? `${props.activeCount} / ${props.maxActive}` : String(props.activeCount)))
const usageRatio = computed(() => (hasLimit.value ? Math.min(1, props.activeCount / props.maxActive) : 0))
</script>

<template>
  <div class="new-card">
    <div
      class="create"
      :class="{ 'is-limit-reached': props.isLimitReached }"
    >
      <RouterLink
        :to="props.to"
        class="create-link"
      >
        <span
          class="icon"
          aria-hidden="true"
        >
          <Plus />
        </span>
        <span class="title">{{ props.title }}</span>
      </RouterLink>

      <div class="usage">
        <div class="usage-head">
          <span>{{ props.usageLabel }}</span>
          <span class="usage-value">{{ usageValue }}</span>
        </div>
        <div
          v-if="hasLimit"
          class="usage-bar"
          aria-hidden="true"
        >
          <span :style="{ transform: `scaleX(${usageRatio})` }" />
        </div>
        <p class="usage-footnote">
          {{ props.footnote }}
        </p>
      </div>

      <div
        v-if="props.isLimitReached && props.limitCtaLabel"
        class="limit-cta"
      >
        <button
          type="button"
          :disabled="props.isLimitCtaBusy"
          :aria-busy="props.isLimitCtaBusy || undefined"
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

    <button
      v-if="props.hubTitle"
      type="button"
      class="hub"
      :disabled="props.isHubBusy"
      :aria-busy="props.isHubBusy || undefined"
      @click="emit('create-hub')"
    >
      <span
        class="icon"
        aria-hidden="true"
      >
        <Loader2
          v-if="props.isHubBusy"
          class="is-spinning"
        />
        <LayoutGrid v-else />
      </span>
      <span class="text">
        <span class="title">{{ props.isHubBusy && props.hubBusyLabel ? props.hubBusyLabel : props.hubTitle }}</span>
        <span
          v-if="props.hubDescription"
          class="description"
        >
          {{ props.hubDescription }}
        </span>
      </span>
    </button>
  </div>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorListings/components/EditorListingsCreateCard.vue */
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/buttons' as buttons;

.new-card {
  --ui-new-card-ink: #{$secondary-text};
  --ui-new-card-muted: #{rgba($secondary-text, 0.72)};
  --ui-new-card-line: #{rgba($secondary, 0.1)};

  width: 100%;
  min-width: 0;
  aspect-ratio: 9 / 13;

  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-sm);

  // Action principale : toute la carte pointillée est cliquable (lien étiré),
  // le bouton de limite reste au-dessus du lien.
  > .create {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--layout-gap-md);

    display: flex;
    flex-direction: column;
    gap: var(--layout-gap-md);

    border: 2px dashed rgba($secondary, 0.2);
    border-radius: borders.$rounded-xl;
    background: $accent-surface-0;
    @include animations.transition(animations.$duration-fast);

    // Appui sur la carte (lien étiré), sauf sur le bouton de limite qui a le sien.
    &:not(:has(> .limit-cta:active)) {
      @include animations.press(0.98);
    }

    > .create-link {
      flex: 1 1 auto;

      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--layout-gap-sm);

      color: var(--ui-new-card-ink);
      text-decoration: none;
      outline: none;

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
      }

      > .icon {
        width: 3rem;
        height: 3rem;

        display: grid;
        place-items: center;

        border-radius: borders.$rounded;
        background: $secondary;
        color: $accent;
        @include animations.transition(animations.$duration-fast);

        > svg {
          width: 1.4rem;
          height: 1.4rem;
        }
      }

      > .title {
        text-align: center;
        @include base-text($bold: true);
      }
    }

    > .usage {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      > .usage-head {
        display: flex;
        justify-content: space-between;
        gap: var(--layout-gap-sm);
        @include little-text($color: var(--ui-new-card-muted), $thin: false);

        > .usage-value {
          font-variant-numeric: tabular-nums;
          @include little-text($color: var(--ui-new-card-ink), $bold: true);
        }
      }

      > .usage-bar {
        height: 0.375rem;
        overflow: hidden;
        border-radius: borders.$rounded;
        background: var(--ui-new-card-line);

        > span {
          display: block;
          height: 100%;
          transform-origin: left center;
          border-radius: inherit;
          background: $secondary;
          @include animations.transition();
        }
      }

      > .usage-footnote {
        margin: 0;
        @include little-text($color: var(--ui-new-card-muted), $thin: false);
      }
    }

    > .limit-cta {
      position: relative;
      z-index: 1;

      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      @include buttons.primary($theme: dark, $fullwidth: true, $little: true);

      > .limit-cta-error {
        margin: 0;
        @include little-text($color: $bad, $thin: false);
      }
    }

    @include on-hover {
      border-color: rgba($secondary, 0.35);
      background: $accent;

      > .create-link > .icon {
        transform: scale(1.06);

        @include animations.reduced-motion {
          transform: none;
        }
      }
    }

    &:has(> .create-link:focus-visible) {
      border-color: $secondary;
      background: $accent;
    }

    &.is-limit-reached > .usage {
      > .usage-bar > span {
        background: $bad;
      }

      > .usage-footnote {
        @include little-text($color: var(--ui-new-card-ink), $thin: false);
      }
    }
  }

  // Action secondaire, plus rare : une tuile pleine et compacte sous la carte principale.
  > .hub {
    width: 100%;
    padding: var(--layout-gap-sm);

    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--layout-gap-sm);

    text-align: left;
    color: var(--ui-new-card-ink);
    cursor: pointer;

    border: 1px solid var(--ui-new-card-line);
    border-radius: borders.$rounded-lg;
    background: $accent;
    @include animations.transition(animations.$duration-fast);
    @include animations.press(0.98);

    > .icon {
      flex: 0 0 auto;
      width: 2.5rem;
      height: 2.5rem;

      display: grid;
      place-items: center;

      border-radius: borders.$rounded-md;
      background: $accent-surface-2;

      > svg {
        width: 1.15rem;
        height: 1.15rem;
      }
    }

    > .text {
      // Passe sous l'icône quand la colonne est étroite plutôt que d'écraser le texte.
      flex: 1 1 8rem;
      min-width: 0;

      display: flex;
      flex-direction: column;

      > .title {
        @include little-text($bold: true);
      }

      > .description {
        @include little-text($color: var(--ui-new-card-muted), $thin: false);
      }
    }

    @include on-hover(':not(:disabled)') {
      border-color: rgba($secondary, 0.25);
      transform: translateY(-1px);
      @include soft-shadow($color: rgba($secondary, 0.08));

      @include animations.reduced-motion {
        transform: none;
      }
    }

    &:focus-visible {
      outline: 2px solid $secondary;
      outline-offset: 2px;
    }

    &:disabled {
      cursor: progress;
      opacity: 0.7;
    }
  }

  .is-spinning {
    animation: ui-new-card-spin 900ms linear infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
}

@keyframes ui-new-card-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
