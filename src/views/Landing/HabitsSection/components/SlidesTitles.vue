<!-- File: src/views/Landing/HabitsSection/components/SlidesTitles.vue -->

<script setup lang="ts">
// DEPS
import { activeSlideIndex, illustrationSize, descriptionSize } from '@/views/Landing/HabitsSection/stores/slider'
import { onMounted, ref } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'

interface SlideTitle {
  title: string
  description: string
}

const slideTitles: SlideTitle[] = [
  {
    title: `Vos factures et vos performances <strong>au même endroit</strong>`,
    description: `Obtenez une vue claire et complète de vos performances : revenus générés, taux d’occupation, logements les plus populaires, et fidélité de vos voyageurs. Exportez facilement vos statistiques mensuelles détaillées et accédez rapidement à toutes vos factures en un clic.`,
  },
  {
    title: `Vos réservations syncronisées et triées dans un <strong>espace intuitif</strong>`,
    description: `Ajoutez simplement le lien du calendrier Airbnb ou Booking sur votre annonce IndieHost : vos dates réservées ailleurs seront automatiquement bloquées ici, et vice versa.
    <br /><br />
    Accédez aux historiques de réservation complets et organisés par logement. Consultez les informations utiles de vos voyageurs, suivez les paiements et gérez chaque réservation au besoin.`,
  },
  {
    title: `Des paiements pratiques, flexibles et <strong>sécurisées</strong>`,
    description: `Ne perdez plus aucun voyageur à cause d’un moyen de paiement limité. Acceptez facilement les méthodes qui vous conviennent : paiement intégral en ligne par CB, ou acompte en ligne et solde en espèces. Vos voyageurs réservent ainsi sans friction et en toute confiance.`,
  },
  {
    title: `Communiquez <strong>simplement</strong>`,
    description: `Échangez simplement avec vos voyageurs grâce à la messagerie IndieHost : sécurisée, instantanée et modérée. Lorsqu’un visiteur scanne votre guide d’accueil, il peut vous écrire sans créer de compte. Vous reprenez ainsi le lien, même si la réservation vient d’une autre plateforme.`,
  },
]

const descriptionRef = ref<HTMLElement | null>(null)

onMounted(() => {
  descriptionSize.value = descriptionRef.value?.clientHeight || 0
})
</script>

<template>
  <div class="content">
    <h2> Gardez les mêmes <span class="gradient-text">habitudes</span> </h2>

    <div class="slides-titles">
      <div>
        <h3
          v-for="(txt, idx) in slideTitles"
          :key="idx"
          v-html="txt.title"
          :class="['title', { active: idx === activeSlideIndex }]"
          aria-live="polite"
        />
      </div>
      <div
        ref="descriptionRef"
        :style="`transform: translateY(${vp.lg.value ? 0 : illustrationSize + 16}px)`"
      >
        <p
          v-for="(txt, idx) in slideTitles"
          :key="idx"
          v-html="txt.description"
          :class="['description', { active: idx === activeSlideIndex }]"
          aria-live="polite"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/assets/styles/variables/globals' as *;
@use '@/assets/styles/variables/animations' as animations;

.content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: end;
  gap: 1.5rem;

  position: relative;

  @include min-width(lg) {
    width: 50%;
    height: 100%;
  }

  h2 {
    width: 100%;
    margin-bottom: 0 !important;

    text-align: center;
    @include h2-title($accent, false);

    @include min-width(lg) {
      margin-bottom: 0;

      text-align: left;

      position: absolute;
      top: 1rem;
      left: 0;
    }
  }

  .slides-titles {
    width: 100%;

    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.25rem;

    @include min-width(lg) {
      align-items: end;
    }

    div {
      width: 100%;

      display: grid;
      grid-template: 1fr / 1fr;
      justify-items: center;

      @include min-width(lg) {
        padding-top: 10%;
        justify-items: end;
      }

      .title {
        width: 100%;
        height: auto;

        grid-area: 1 / 1;
        align-self: end;

        opacity: 0;
        transform: translateY(-30px);

        pointer-events: none;

        text-align: center;
        @include h4-title($accent);
        @include animations.transition(750ms);

        @include min-width(lg) {
          text-align: left;
          @include h3-title($accent);
        }

        * {
          color: $accent !important;
        }

        &.active {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
      }

      .description {
        width: 100%;
        height: auto;

        grid-area: 1 / 1;
        align-self: start;

        opacity: 0;
        transform: translateY(30px);

        pointer-events: none;

        text-align: center;
        @include base-text($accent);
        @include animations.transition(750ms);

        @include min-width(lg) {
          text-align: left;
        }

        &.active {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
      }
    }

    div:nth-child(2) {
      padding-top: 0 !important;
      transform: translateY(135%);

      @include min-width(lg) {
        transform: translateY(0);
      }
    }
  }
}
</style>
