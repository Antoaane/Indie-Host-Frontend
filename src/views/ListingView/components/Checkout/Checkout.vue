<!-- File: src/views/ListingView/components/Checkout/Checkout.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CalendarDays,
  ChevronLeft,
  CreditCard,
  Globe,
  Lock,
  MapPin,
  Star,
  User,
} from 'lucide-vue-next'

import type { ListingParsed } from '@/views/ListingView/types/listing'
import type { ReservationPayload } from '@/views/ListingView/types/reservation'

const props = defineProps<{
  reservation: ReservationPayload
  listing: ListingParsed
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
}>()

const paymentChoice = ref<'full' | 'split' | 'cash'>('full')

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const total = computed(() => props.reservation.total)
const splitNow = computed(() => Math.round(total.value * 0.5))
const splitLater = computed(() => Math.max(0, total.value - splitNow.value))
const cashNow = computed(() => Math.round(total.value * 0.25))
const cashLater = computed(() => Math.max(0, total.value - cashNow.value))

const totalLabel = computed(() => currency.format(total.value))
const splitNowLabel = computed(() => currency.format(splitNow.value))
const splitLaterLabel = computed(() => currency.format(splitLater.value))
const cashNowLabel = computed(() => currency.format(cashNow.value))
const cashLaterLabel = computed(() => currency.format(cashLater.value))

const dueDateLabel = computed(() => {
  const base = props.reservation.startISO ? new Date(props.reservation.startISO) : null
  if (!base || Number.isNaN(base.getTime())) return 'le jour d\'arrivée'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(base)
})

const listingTitle = computed(() => props.listing.title.title)
const listingHost = computed(() => {
  const host = props.listing.hostProfile
  if (!host?.name) return ''
  return `à ${host.name}`
})
const listingLocation = computed(() => {
  const title = props.listing.title
  return `${title.type} - ${title.location.city}, ${title.location.country}`
})
const listingRating = computed(() => props.listing.notes?.overall ?? props.listing.hostProfile?.globalNote ?? null)
const listingImage = computed(() => {
  const images = props.listing.medias?.images ?? []
  if (!images.length) return ''
  const sorted = [...images].sort((a, b) => a.position - b.position)
  return sorted[0]?.src ?? ''
})
</script>

<template>
  <section
    id="checkout"
    class="listing-checkout"
  >
    <div class="header checkout-header">
      <h2>Confirmez et payez</h2>
      <button
        type="button"
        class="cancel"
        @click="emit('cancel')"
      >
        <ChevronLeft :size="16" />
        Annuler
      </button>
    </div>

    <div class="listing-cover">
      <div class="thumb">
        <img
          v-if="listingImage"
          :src="listingImage"
          :alt="listingTitle"
        />
        <div
          v-else
          class="thumb-placeholder"
        >
          Photo
        </div>
      </div>
      <div class="info">
        <h3>{{ listingTitle }}</h3>
        <p
          v-if="listingHost"
          class="host"
        >
          {{ listingHost }}
        </p>
        <p class="location">{{ listingLocation }}</p>
        <div
          v-if="listingRating"
          class="rating"
        >
          <Star :size="14" />
          <span>{{ listingRating.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <section class="checkout-section">
      <h3>Vos préférences</h3>
      <div
        class="preference-card"
        role="radiogroup"
        aria-label="Options de paiement"
      >
        <label
          class="preference-option"
          :class="{ 'is-selected': paymentChoice === 'full' }"
        >
          <input
            v-model="paymentChoice"
            type="radio"
            value="full"
          />
          <div class="content">
            <p class="title">Payer {{ totalLabel }} maintenant</p>
          </div>
          <span class="indicator" />
        </label>

        <label
          class="preference-option"
          :class="{ 'is-selected': paymentChoice === 'split' }"
        >
          <input
            v-model="paymentChoice"
            type="radio"
            value="split"
          />
          <div class="content">
            <p class="title">Payer une partie maintenant et l'autre plus tard</p>
            <p class="subtitle">
              {{ splitNowLabel }} à payer aujourd'hui, {{ splitLaterLabel }} à payer le {{ dueDateLabel }}.
              <button
                type="button"
                class="link"
              >
                Plus d'informations
              </button>
            </p>
          </div>
          <span class="indicator" />
        </label>

        <label
          class="preference-option"
          :class="{ 'is-selected': paymentChoice === 'cash' }"
        >
          <input
            v-model="paymentChoice"
            type="radio"
            value="cash"
          />
          <div class="content">
            <p class="title">Payer en espèce</p>
            <p class="subtitle">
              {{ cashNowLabel }} à payer aujourd'hui, {{ cashLaterLabel }} en espèce le premier jour de location.
              <button
                type="button"
                class="link"
              >
                Plus d'informations
              </button>
            </p>
          </div>
          <span class="indicator" />
        </label>
      </div>
    </section>

    <section class="checkout-section">
      <h3>Votre mode de paiement</h3>
      <div class="payment-brands">
        <span class="brand">Visa</span>
        <span class="brand">Amex</span>
        <span class="brand">PayPal</span>
        <span class="brand">Apple Pay</span>
        <span class="brand">G Pay</span>
      </div>

      <div class="payment-fields">
        <label class="field select">
          <select aria-label="Mode de paiement">
            <option selected>Carte bancaire</option>
            <option>Apple Pay</option>
            <option>PayPal</option>
          </select>
        </label>

        <label class="field">
          <CreditCard class="icon" />
          <input
            type="text"
            inputmode="numeric"
            placeholder="Numéros de carte"
            aria-label="Numéros de carte"
          />
          <Lock class="icon is-right" />
        </label>

        <div class="field-grid">
          <label class="field">
            <User class="icon" />
            <input
              type="text"
              placeholder="Nom sur la carte"
              aria-label="Nom sur la carte"
            />
          </label>
          <label class="field">
            <CalendarDays class="icon" />
            <input
              type="text"
              placeholder="MM/AA"
              aria-label="Date d'expiration"
            />
          </label>
          <label class="field">
            <Lock class="icon" />
            <input
              type="text"
              inputmode="numeric"
              placeholder="CVV"
              aria-label="Code de sécurité"
            />
          </label>
        </div>

        <div class="field-grid">
          <label class="field">
            <MapPin class="icon" />
            <input
              type="text"
              placeholder="Code postal"
              aria-label="Code postal"
            />
          </label>
          <label class="field">
            <Globe class="icon" />
            <input
              type="text"
              placeholder="Pays/région"
              aria-label="Pays ou région"
            />
          </label>
        </div>
      </div>
    </section>

    <section class="checkout-section">
      <h3>Informations nécessaires</h3>
      <p class="section-subtitle">Dites nous-en un peu plus sur vous</p>
      <div class="info-list">
        <div class="info-item">
          <div>
            <p class="info-title">Dites nous-en un peu plus sur vous</p>
            <p class="info-text">Donnez la raison de votre voyage, votre nombre, etc.</p>
          </div>
          <div class="add-button">
            <button type="button">Ajouter</button>
          </div>
        </div>
        <div class="info-item">
          <div>
            <p class="info-title">Votre numéro de téléphone</p>
            <p class="info-text">Pour que IndieHost puisse vous transmettre des informations complémentaires si besoin</p>
          </div>
          <div class="add-button">
            <button type="button">Ajouter</button>
          </div>
        </div>
      </div>
    </section>

    <section class="checkout-section">
      <h3>Un petit rappel</h3>
      <p class="section-text">
        Votre hôte a mis tout son coeur pour que vous passiez un bon moment. De votre côté, un petit geste :
        <strong>veillez à prendre soin du lieu et respectez les consignes.</strong>
        De cette façon, l'expérience reste top pour tout le monde.
      </p>
    </section>

    <section class="checkout-section">
      <h3>Politique de remboursement</h3>
      <ul class="policy-list">
        <li>Remboursement intégrale possible jusqu'à 7 jours avant la date de réservation</li>
        <li>Remboursement partiel jusqu'à 48h avant la date de réservation</li>
        <li>
          Des charges additionnelles peuvent s'ajouter après coup en cas de
          <button
            type="button"
            class="link"
          >
            dommages importants
          </button>
          . Aucun montant de vous sera prélevé avant de vous avoir contacté.
        </li>
      </ul>
    </section>

    <section class="checkout-section">
      <h3>C'est parti</h3>
      <p class="section-text">
        En cliquant sur le bouton ci-dessous, j'accepte les conditions suivantes :
        <button
          type="button"
          class="link"
        >
          Règlement intérieur de l'hôte
        </button>
        ,
        <button
          type="button"
          class="link"
        >
          Règles de base pour les voyageurs
        </button>
        , Politique Airbnb de remplacement d'hébergement et de remboursement et je donne mon accord pour
        qu'Airbnb débite mon mode de paiement si je suis responsable de dommages. Conditions de paiement entre vous et
        Airbnb Payments Luxembourg S.A.
      </p>
      <p class="section-text">
        J'accepte également les
        <button
          type="button"
          class="link"
        >
          Conditions de service modifiées
        </button>
        , les
        <button
          type="button"
          class="link"
        >
          Conditions de service relatives aux paiements
        </button>
        et j'ai pris connaissance de la
        <button
          type="button"
          class="link"
        >
          Politique de confidentialité
        </button>
        .
      </p>
    </section>

    <div class="checkout-cta">
      <div class="btn-primary__full">
        <button type="button">Confirmer et payer</button>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Checkout/checkout.scss';
</style>
