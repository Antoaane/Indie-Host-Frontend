<!-- File: src/components/layouts/BootLoader.vue -->

<script setup lang="ts">
import { useRouter } from 'vue-router'

import LogoIconLight from '@/components/svgs/icons/LogoIconLight.vue'
import { startBootLoader, useBootLoader } from '@/composables/useBootLoader'
import commonLocale from '@/locales/common/fr.json'

const { isBootLoaderActive } = useBootLoader()

startBootLoader(useRouter())
</script>

<template>
  <Transition
    name="boot-loader"
    appear
  >
    <div
      v-if="isBootLoaderActive"
      class="boot-loader"
      role="status"
      aria-live="polite"
    >
      <div class="mark">
        <span
          class="halo"
          aria-hidden="true"
        />
        <LogoIconLight class="logo" />
      </div>

      <span
        class="track"
        aria-hidden="true"
      >
        <span class="bar" />
      </span>

      <span class="label">{{ commonLocale.bootLoader.label }}</span>
    </div>
  </Transition>
</template>

<style lang="scss">
/* File: src/components/layouts/BootLoader.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

.boot-loader {
  position: fixed;
  inset: 0;
  // Au-dessus de la barre du site (9999), affichée avant que la route soit connue.
  z-index: 10000;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--layout-gap-xl);

  background-color: $background;

  > .mark {
    position: relative;
    display: grid;
    place-items: center;
    width: 4rem;
    height: 4rem;

    // Halo de marque qui respire : signe de vie sans spinner.
    > .halo {
      position: absolute;
      inset: -75%;
      border-radius: borders.$rounded;
      background: radial-gradient(
        circle,
        rgba($primary_gradiant_first, 0.5) 0%,
        rgba($primary_gradiant_second, 0.28) 35%,
        rgba($primary_gradiant_third, 0) 68%
      );
      animation: boot-loader-breathe calc(#{animations.$duration-overlay} * 8) animations.$ease-in-out infinite alternate;
    }

    > .logo {
      position: relative;
      width: 100%;
      height: 100%;
    }
  }

  // Barre indéterminée : courte, discrète, elle dit que ça avance.
  > .track {
    position: relative;
    width: 4.5rem;
    height: 0.1875rem;
    overflow: hidden;
    border-radius: borders.$rounded;
    background-color: rgba($secondary, 0.08);

    > .bar {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 40%;
      border-radius: borders.$rounded;
      background-color: $secondary;
      animation: boot-loader-progress calc(#{animations.$duration-overlay} * 4) animations.$ease-in-out infinite;
    }
  }

  > .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @include animations.reduced-motion {
    > .mark > .halo {
      animation: none;
    }

    > .track > .bar {
      width: 100%;
      animation: none;
      opacity: 0.35;
    }
  }
}

@keyframes boot-loader-breathe {
  from {
    opacity: 0.55;
    transform: scale(0.92);
  }

  to {
    opacity: 1;
    transform: scale(1.04);
  }
}

@keyframes boot-loader-progress {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(250%);
  }
}

// Entrée douce ; sortie en fondu pendant que le tableau de bord monte d'un seul bloc.
.boot-loader-enter-active {
  @include animations.transition(animations.$duration-base, animations.$ease-out, opacity);
}

.boot-loader-leave-active {
  @include animations.transition(animations.$duration-overlay, animations.$ease-out, opacity);

  > .mark {
    @include animations.transition(animations.$duration-overlay, animations.$ease-out, transform);
  }
}

.boot-loader-enter-from,
.boot-loader-leave-to {
  opacity: 0;
}

.boot-loader-leave-to > .mark {
  transform: scale(1.06);
}

// `is-booting` est posée dès le <head> (index.html) : fond clair avant même le montage
// de l'app, là où le body mobile est sombre par défaut.
html.is-booting body {
  background-color: $background;
}

// Le contenu reste caché sous l'écran, puis glisse en place au moment du retrait.
html.is-booting #app > main {
  opacity: 0;
  transform: translateY(0.75rem);
}

html.is-boot-revealing #app > main {
  @include animations.transition(animations.$duration-overlay, animations.$ease-out, (opacity, transform));
}

@include animations.reduced-motion {
  html.is-booting #app > main {
    transform: none;
  }

  .boot-loader-leave-to > .mark {
    transform: none;
  }
}
</style>
