<!-- File: src/views/ListingView/components/Core/components/Title/Title.vue -->

<script setup lang="ts">
// TYPES
import type { ReviewsSummary, TitleModel } from '@/views/ListingView/types/listing'
import { computed } from 'vue'
import { Star } from '@lucide/vue'
import { formatICUMessage } from '@/utils/i18n'
import { sanitizeHtml } from '@/utils/sanitizeHtml'

interface StaticContent {
  travelers: string
  beds: string
  bedrooms: string
  bathrooms: string
  /** Libellé devant le numéro d'enregistrement du meublé de tourisme (loi Le Meur). */
  registrationNumber?: string
}

const FALLBACK_REGISTRATION_LABEL = 'N° d’enregistrement'

const props = defineProps<{
  data: TitleModel
  staticContent: StaticContent
  /** Note de la section des avis, quand la page veut la rappeler sous le titre (téléphone). */
  rating?: ReviewsSummary | null
}>()

const scoreFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
const ratingScore = computed(() => {
  if (!props.rating) return ''
  const score = scoreFormatter.format(props.rating.score)
  return props.rating.outOf === 10 ? `${score}/10` : score
})

// Vers les avis, plus bas dans la page : le lien fait défiler au lieu de changer l'adresse.
function scrollToReviews(event: MouseEvent) {
  const target = document.getElementById('comments')
  if (!target) return
  event.preventDefault()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

const travelerLabel = computed(() => formatICUMessage(props.staticContent.travelers, { count: props.data.guest_capacity }))

const bedroomLabel = computed(() => formatICUMessage(props.staticContent.bedrooms, { count: props.data.bedrooms.quantity }))

const bedsLabel = computed(() => formatICUMessage(props.staticContent.beds, { count: props.data.bedrooms.bed ?? 0 }))

const bathroomsLabel = computed(() => formatICUMessage(props.staticContent.bathrooms, { count: props.data.bathrooms }))

// Affiché seulement quand l'hôte l'a renseigné : obligatoire dans les communes qui l'exigent.
const registrationNumber = computed(() => props.data.tourismRegistrationNumber?.trim() ?? '')
const registrationLabel = computed(() => props.staticContent.registrationNumber || FALLBACK_REGISTRATION_LABEL)
</script>

<template>
  <div class="listing-title">
    <h1 v-html="sanitizeHtml(data.title)" />
    <h2 v-html="sanitizeHtml(`${data.type} — ${data.location.city}, ${data.location.country}`)" />
    <ul>
      <li> {{ data.guest_capacity }} {{ travelerLabel }} </li>

      <li v-html="`<span></span> ${data.bedrooms.quantity} ${bedroomLabel}`" />
      <li
        v-if="data.bedrooms.bed"
        v-html="`<span></span> ${data.bedrooms.bed} ${bedsLabel}`"
      />

      <li v-html="`<span></span> ${data.bathrooms} ${bathroomsLabel}`" />
    </ul>
    <a
      v-if="props.rating"
      class="rating"
      href="#comments"
      @click="scrollToReviews"
    >
      <Star
        v-if="props.rating.outOf === 5"
        :size="14"
        class="star"
        aria-hidden="true"
      />
      <span class="score">{{ ratingScore }}</span>
      <span class="count">· {{ props.rating.countLabel }}</span>
    </a>
    <p
      v-if="registrationNumber"
      class="registration"
    >
      {{ registrationLabel }}&nbsp;: <span class="value">{{ registrationNumber }}</span>
    </p>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-title {
  > h1 {
    @include h1-title($gradiant: true);
  }

  // Sous-titre (type et lieu) : sur téléphone il prenait deux lignes à la taille d'un titre de
  // section, juste sous le nom. Il y passe à la taille du texte courant ; inchangé au-delà.
  > h2 {
    margin: 0 0 var(--layout-gap-2xs);
    @include base-text($bigger: true, $thin: false);

    @include min-width(md) {
      @include h2-title;
      font-weight: 400;
    }
  }

  // Les caractéristiques passent à la ligne entre deux éléments, jamais au milieu de l'un d'eux.
  // Téléphone : en petit, comme une légende.
  > ul {
    display: flex;
    flex-wrap: wrap;
    align-items: center;

    opacity: 0.65;

    .listing-view.is-mobile-layout & {
      opacity: 1;
      @include little-text(rgba($secondary-text, 0.72), $thin: false);
    }

    > li {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;

      > span {
        height: 5px;
        width: 5px;
        margin-inline: 0.5rem;
        margin-top: 3px;

        background-color: $secondary;
        border-radius: borders.$rounded;
      }
    }
  }

  // Note et nombre d'avis : une ligne discrète qui mène aux avis.
  > .rating {
    width: fit-content;
    min-height: var(--tap-target);
    margin-bottom: calc(var(--layout-gap-sm) * -1);

    display: inline-flex;
    align-items: center;
    gap: var(--layout-gap-xs);

    text-decoration: none;

    > .star {
      flex: 0 0 auto;
      fill: currentColor;
      color: $secondary-text;
    }

    > .score {
      @include little-text($secondary-text, $bold: true);
      font-variant-numeric: tabular-nums;
    }

    > .count {
      @include little-text(rgba($secondary-text, 0.72), $thin: false);
      text-decoration: underline;
      text-underline-offset: 0.2rem;
    }

    &:focus-visible {
      outline: 2px solid $secondary;
      outline-offset: 2px;
      border-radius: borders.$rounded-xs;
    }
  }

  > .registration {
    margin: var(--layout-gap-xs) 0 0;
    @include little-text($thin: false);
    color: rgba($secondary-text, 0.7);

    > .value {
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
  }
}
</style>
