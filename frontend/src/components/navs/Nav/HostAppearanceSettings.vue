<!-- File: src/components/navs/Nav/HostAppearanceSettings.vue -->

<!-- « Mon profil » → Apparence : thème du tableau de bord. Automatique par défaut (il suit le système) ;
     l'hôte peut forcer le clair ou le sombre. Réglage volontairement discret : la plupart n'y touchent pas. -->

<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, Moon, Sun } from 'lucide-vue-next'

import { useColorScheme, type ColorSchemePreference } from '@/composables/useColorScheme'

const { preference, systemScheme, setPreference } = useColorScheme()

const options: Array<{ value: ColorSchemePreference; label: string; icon: typeof Sun }> = [
  { value: 'auto', label: 'Automatique', icon: Monitor },
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
]

const hint = computed(() => {
  if (preference.value !== 'auto') return 'Ce choix est gardé sur cet appareil.'
  return `Suit le réglage de votre appareil : ${systemScheme.value === 'dark' ? 'sombre' : 'clair'} en ce moment.`
})
</script>

<template>
  <section
    class="host-appearance-settings"
    aria-labelledby="host-appearance-settings-title"
  >
    <h3 id="host-appearance-settings-title">
      Apparence
    </h3>

    <div
      class="choices"
      role="radiogroup"
      aria-labelledby="host-appearance-settings-title"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        class="choice"
        :class="{ 'is-selected': preference === option.value }"
        :aria-checked="preference === option.value"
        @click="setPreference(option.value)"
      >
        <component
          :is="option.icon"
          :size="16"
          aria-hidden="true"
        />
        {{ option.label }}
      </button>
    </div>

    <p class="hint">{{ hint }}</p>
  </section>
</template>

<style lang="scss">
/* File: src/components/navs/Nav/HostAppearanceSettings.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

.host-appearance-settings {
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-sm);
  padding-top: var(--layout-gap);
  border-top: 1px solid rgba($secondary, 0.08);

  > h3 {
    margin: 0;
    @include h4-title($colorful: false);
  }

  // Trois choix dans une même réglette.
  > .choices {
    padding: var(--layout-gap-2xs);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--layout-gap-2xs);
    border-radius: borders.$rounded-md;
    background: $tertiary;

    > .choice {
      min-height: 2.75rem;
      padding: 0 var(--layout-gap-xs);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;

      border: 0;
      border-radius: borders.inner(borders.$rounded-md, var(--layout-gap-2xs));
      background: none;
      cursor: pointer;
      @include little-text(rgba($secondary-text, 0.72), $thin: false);
      @include animations.transition(animations.$duration-fast, animations.$ease-out, (background-color, color));
      @include animations.press();

      @include on-hover {
        color: $secondary;
      }

      &:focus-visible {
        outline: 2px solid $secondary;
        outline-offset: 2px;
      }

      &.is-selected {
        background: $accent;
        color: $secondary;
        font-weight: 700;
        @include soft-shadow();
      }
    }
  }

  > .hint {
    margin: 0;
    @include little-text(rgba($secondary-text, 0.72), $thin: false);
  }
}
</style>
