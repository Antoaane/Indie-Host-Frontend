<!-- File: src/components/layouts/BootLoader.vue -->

<script setup lang="ts">
import { useAuth } from '@clerk/vue'
import { watch } from 'vue'
import { useRouter } from 'vue-router'

import { startBootLoader, useBootLoader } from '@/composables/useBootLoader'
import commonLocale from '@/locales/common/fr.json'

const { isBootLoaderActive } = useBootLoader()
const { isLoaded } = useAuth()

const whenAuthReady = new Promise<void>((resolve) => {
  if (isLoaded.value) {
    resolve()
    return
  }
  const stop = watch(isLoaded, (loaded) => {
    if (!loaded) return
    stop()
    resolve()
  })
})

startBootLoader(useRouter(), whenAuthReady)
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
      <div class="stage">
        <div
          class="mark"
          aria-hidden="true"
        >
          <span class="glow">
            <span class="aura" />
          </span>

          <!-- Silhouette du logo (LogoIcon*) redessinée en `currentColor` : elle suit le thème,
               et sa tête s’anime à part. Cadre resserré autour de la silhouette. -->
          <svg
            class="figure"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="13 6 24 38"
          >
            <defs>
              <linearGradient
                id="boot-loader-head-fill"
                x1="25"
                x2="25"
                y1="7.08923"
                y2="20.5366"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0.484"
                  stop-color="currentColor"
                />
                <stop
                  offset="1"
                  stop-color="currentColor"
                  stop-opacity="0"
                />
              </linearGradient>
              <linearGradient
                id="boot-loader-body-fill"
                x1="25"
                x2="25"
                y1="20.5366"
                y2="42.9107"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0.684"
                  stop-color="currentColor"
                />
                <stop
                  offset="1"
                  stop-color="currentColor"
                  stop-opacity="0"
                />
              </linearGradient>
            </defs>
            <path
              class="body"
              fill="url(#boot-loader-body-fill)"
              d="M25 20.5366L13.8414 42.9107H36.1583L25 20.5366Z"
            />
            <ellipse
              class="head"
              cx="25"
              cy="13.8129"
              rx="7.00979"
              ry="6.72368"
              fill="url(#boot-loader-head-fill)"
            />
          </svg>
        </div>

        <p class="label">
          {{ commonLocale.bootLoader.label }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss">
/* File: src/components/layouts/BootLoader.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

/* Un cycle de respiration (aller ou retour) : la tête et l’aura partagent ce tempo. */
$boot-loader-breath: calc(#{animations.$duration-overlay} * 6);

.boot-loader {
  position: fixed;
  inset: 0;
  /* Au-dessus de la barre du site (9999), affichée avant que la route soit connue. */
  z-index: 10000;

  display: grid;
  place-items: center;

  /* Diamètre de l’aura, et son intensité : moindre en thème sombre, où la même lueur éblouit. */
  --ui-boot-loader-glow: 12rem;
  --ui-boot-loader-glow-strength: 1;

  color: $secondary;
  background-color: $background;

  /* Le thème peut changer sous l’écran (hôte connecté arrivé par l’accueil) : fondu, pas de saut. */
  @include animations.transition(animations.$duration-overlay, animations.$ease-out, (background-color, color));

  > .stage {
    position: relative;
    display: grid;
    justify-items: center;

    /* Seule la silhouette occupe la place : elle reste au centre exact de l’écran, le texte
       se pose dessous sans la décaler. */
    > .mark {
      position: relative;
      display: grid;
      place-items: center;

      /* Entrée après un court temps : un changement d’écran rapide ne fait pas clignoter le logo. */
      animation: boot-loader-mark-in animations.$duration-overlay animations.$ease-out animations.$duration-fast both;

      > .glow {
        position: absolute;
        top: 50%;
        left: 50%;
        width: var(--ui-boot-loader-glow);
        aspect-ratio: 1;
        translate: -50% -50%;
        border-radius: borders.$rounded;
        opacity: 0.75;
        pointer-events: none;
        animation: boot-loader-breathe $boot-loader-breath animations.$ease-in-out infinite alternate;

        /* Trois lueurs de la marque qui dérivent lentement ; le masque fond leurs bords dans le
           fond de l’écran (aucun disque visible). */
        > .aura {
          position: absolute;
          inset: 0;
          border-radius: borders.$rounded;
          opacity: var(--ui-boot-loader-glow-strength);
          background:
            radial-gradient(circle at 32% 34%, rgba($primary_gradiant_first, 0.95), rgba($primary_gradiant_first, 0) 58%),
            radial-gradient(circle at 70% 42%, rgba($primary_gradiant_second, 0.8), rgba($primary_gradiant_second, 0) 56%),
            radial-gradient(circle at 46% 72%, rgba($primary_gradiant_third, 0.95), rgba($primary_gradiant_third, 0) 58%);
          mask-image: radial-gradient(closest-side, $dark 35%, transparent 100%);
          animation: boot-loader-drift calc(#{animations.$duration-overlay} * 40) linear infinite;
        }
      }

      > .figure {
        position: relative;
        display: block;
        height: 3.5rem;
        width: auto;
        aspect-ratio: 24 / 38;
        overflow: visible;

        > .head {
          transform-box: fill-box;
          transform-origin: center;
          animation: boot-loader-float $boot-loader-breath animations.$ease-in-out infinite alternate;
        }
      }
    }

    /* Rassure seulement quand l’attente dure : invisible sur un chargement rapide. Posé sous la
       traîne de l’aura, pas dedans. */
    > .label {
      position: absolute;
      top: calc(50% + var(--ui-boot-loader-glow) * 0.4);
      left: 50%;
      translate: -50% 0;
      white-space: nowrap;

      @include little-text(rgba($secondary-text, 0.72));

      animation: boot-loader-label-in animations.$duration-overlay animations.$ease-out calc(#{animations.$duration-overlay} * 5) both;
    }
  }

  @include animations.reduced-motion {
    > .stage > .mark,
    > .stage > .label {
      animation-name: boot-loader-fade-in;
    }

    > .stage > .mark > .glow,
    > .stage > .mark > .glow > .aura,
    > .stage > .mark > .figure > .head {
      animation: none;
    }
  }
}

html[data-theme='dark'] .boot-loader {
  --ui-boot-loader-glow-strength: 0.62;
}

@keyframes boot-loader-mark-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}

@keyframes boot-loader-label-in {
  from {
    opacity: 0;
    transform: translateY(0.25rem);
  }
}

@keyframes boot-loader-fade-in {
  from {
    opacity: 0;
  }
}

/* La tête se soulève : la silhouette respire. */
@keyframes boot-loader-float {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(-18%);
  }
}

/* L’aura s’ouvre quand la tête se soulève. */
@keyframes boot-loader-breathe {
  from {
    opacity: 0.6;
    transform: scale(0.92);
  }

  to {
    opacity: 0.9;
    transform: scale(1.04);
  }
}

@keyframes boot-loader-drift {
  to {
    transform: rotate(1turn);
  }
}

/* Entrée douce ; sortie en fondu pendant que le tableau de bord monte d’un seul bloc. */
.boot-loader-enter-active {
  @include animations.transition(animations.$duration-base, animations.$ease-out, (opacity, background-color, color));
}

.boot-loader-leave-active {
  @include animations.transition(animations.$duration-overlay, animations.$ease-out, opacity);

  > .stage {
    @include animations.transition(animations.$duration-overlay, animations.$ease-out, transform);
  }
}

.boot-loader-enter-from,
.boot-loader-leave-to {
  opacity: 0;
}

.boot-loader-leave-to > .stage {
  transform: scale(1.04);
}

/* `is-booting` est posée dès le <head> (index.html) : fond de l’écran avant même le montage
   de l’app, là où le body mobile est sombre par défaut. */
html.is-booting body {
  background-color: $background;
}

/* Le contenu reste caché sous l’écran, puis glisse en place au moment du retrait. */
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

  .boot-loader-leave-to > .stage {
    transform: none;
  }
}
</style>
