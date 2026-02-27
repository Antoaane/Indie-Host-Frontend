<!-- File: src/views/ListingView/components/Checkout/Checkout.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeft, Lock, Star } from 'lucide-vue-next'
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js'

import type { ListingParsed } from '@/views/ListingView/types/listing'
import type { ReservationPayload } from '@/views/ListingView/types/reservation'
import { createStripePaymentIntent } from '@/domain/api/stripePayments'
import {
  buildStripeReservationMetadata,
  resolveCheckoutPaymentBreakdown,
  type CheckoutPaymentBreakdown,
  type CheckoutPaymentChoice,
} from '@/domain/payments/checkoutPayment'
import {
  resolveCheckoutPaymentChoice,
  validateReservationAgainstRules,
} from '@/domain/listings/reservationRules'
import { getStripePaymentReturnUrl, getStripePublishableKey, loadStripeClient } from '@/domain/payments/stripeClient'

type CheckoutConfirmationPayload = {
  travelerMessage: string
  paymentChoice: CheckoutPaymentChoice
  payment: {
    breakdown: CheckoutPaymentBreakdown
    paymentIntentId: string
    paymentIntentStatus: string
    currency: string
    connectedAccountId: string
  }
}

const ACCEPTED_PAYMENT_INTENT_STATUSES = new Set([
  'succeeded',
  'processing',
  'requires_capture',
])

const props = withDefaults(
  defineProps<{
    reservation: ReservationPayload
    listing: ListingParsed
    listingId: string
    connectedAccountId: string | null
    isSubmitting?: boolean
    submitError?: string | null
  }>(),
  {
    isSubmitting: false,
    submitError: null,
  },
)

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm', payload: CheckoutConfirmationPayload): void
}>()

const paymentChoice = ref<CheckoutPaymentChoice>('full')
const travelerMessageOpen = ref(false)
const travelerMessage = ref('')
const paymentIntentError = ref<string | null>(null)
const isPreparingPayment = ref(false)
const isConfirmingPayment = ref(false)
const paymentElementMount = ref<HTMLDivElement | null>(null)
const paymentIntentId = ref<string | null>(null)
const paymentIntentCurrency = ref('eur')

let stripe: Stripe | null = null
let stripeElements: StripeElements | null = null
let paymentElement: StripePaymentElement | null = null
let intentRequestSequence = 0

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function formatDateLabel(iso?: string | null): string {
  if (!iso) return "le jour d'arrivee"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return "le jour d'arrivee"
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

const reservationValidation = computed(() => validateReservationAgainstRules({
  startISO: props.reservation.startISO,
  endISO: props.reservation.endISO,
  occupants: props.reservation.occupants,
  rules: props.listing.bookings.rules,
}))
const reservationError = computed(() => reservationValidation.value.errors[0] ?? null)
const paymentRules = computed(() => props.listing.bookings.rules.payment)
const allowedPaymentChoices = computed(() => paymentRules.value.allowedChoices)
const paymentOptionError = computed(() =>
  allowedPaymentChoices.value.length
    ? null
    : 'Aucune modalite de paiement valide n est configuree pour cette annonce.',
)

watch(
  () => paymentRules.value,
  (rules) => {
    const next = resolveCheckoutPaymentChoice(paymentChoice.value, rules)
    if (next && next !== paymentChoice.value) {
      paymentChoice.value = next
      return
    }
    if (!next && allowedPaymentChoices.value[0]) {
      paymentChoice.value = allowedPaymentChoices.value[0]
    }
  },
  { immediate: true, deep: true },
)

function isChoiceAllowed(choice: CheckoutPaymentChoice): boolean {
  return allowedPaymentChoices.value.includes(choice)
}

function resolveChoiceBlockedReason(choice: CheckoutPaymentChoice): string {
  return paymentRules.value.blockedReasons[choice] ?? 'Option non autorisee pour cette annonce.'
}

const totalLabel = computed(() => currency.format(props.reservation.total))

const splitBreakdown = computed(() => resolveCheckoutPaymentBreakdown({
  totalAmount: props.reservation.total,
  choice: 'split',
  arrivalDateISO: props.reservation.startISO,
  paymentRules: paymentRules.value,
}))
const cashBreakdown = computed(() => resolveCheckoutPaymentBreakdown({
  totalAmount: props.reservation.total,
  choice: 'cash',
  arrivalDateISO: props.reservation.startISO,
  paymentRules: paymentRules.value,
}))
const selectedBreakdown = computed(() => resolveCheckoutPaymentBreakdown({
  totalAmount: props.reservation.total,
  choice: paymentChoice.value,
  arrivalDateISO: props.reservation.startISO,
  paymentRules: paymentRules.value,
}))

const splitNowLabel = computed(() => currency.format(splitBreakdown.value.chargeNowAmount))
const splitLaterLabel = computed(() => currency.format(splitBreakdown.value.deferredAmount))
const cashNowLabel = computed(() => currency.format(cashBreakdown.value.chargeNowAmount))
const cashLaterLabel = computed(() => currency.format(cashBreakdown.value.deferredAmount))
const selectedChargeNowLabel = computed(() => currency.format(selectedBreakdown.value.chargeNowAmount))
const selectedDeferredLabel = computed(() => currency.format(selectedBreakdown.value.deferredAmount))

const splitDueDateLabel = computed(() => formatDateLabel(splitBreakdown.value.deferredDueDateISO ?? props.reservation.startISO))
const cashDueDateLabel = computed(() => formatDateLabel(cashBreakdown.value.deferredDueDateISO ?? props.reservation.startISO))
const selectedDueDateLabel = computed(() => formatDateLabel(selectedBreakdown.value.deferredDueDateISO ?? props.reservation.startISO))
const paymentBrands = computed(() => {
  const list: string[] = []
  if (paymentRules.value.methods.card) {
    list.push('Carte')
    list.push('Apple Pay')
  }
  if (paymentRules.value.methods.sepa) list.push('SEPA')
  if (paymentRules.value.methods.cash) list.push('Especes')
  return Array.from(new Set(list))
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
  const sorted = [
    ...images,
  ].sort((a, b) => a.position - b.position)
  return sorted[0]?.src ?? ''
})

const travelerMessageCtaLabel = computed(() => (travelerMessageOpen.value ? 'Masquer' : 'Ajouter'))
const isPaymentReady = computed(() => Boolean(paymentElement && stripeElements && stripe && paymentIntentId.value))
const canSubmit = computed(() =>
  !reservationError.value &&
  !paymentOptionError.value &&
  !props.isSubmitting &&
  !isPreparingPayment.value &&
  !isConfirmingPayment.value &&
  isPaymentReady.value &&
  !paymentIntentError.value,
)

const submitLabel = computed(() => {
  if (reservationError.value) return 'Reservation invalide'
  if (paymentOptionError.value) return 'Paiement indisponible'
  if (props.isSubmitting) return 'Validation de la réservation...'
  if (isConfirmingPayment.value) return 'Confirmation du paiement...'
  if (isPreparingPayment.value) return 'Préparation du paiement...'
  return `Confirmer et payer ${selectedChargeNowLabel.value}`
})

function toggleTravelerMessage() {
  travelerMessageOpen.value = !travelerMessageOpen.value
}

function resetPaymentElement() {
  if (paymentElement) {
    paymentElement.unmount()
    paymentElement.destroy()
    paymentElement = null
  }
  stripeElements = null
}

function getPaymentSetupError(): string | null {
  if (!props.listingId?.trim()) return "Impossible de déterminer l'annonce pour le paiement."
  if (!props.connectedAccountId?.trim()) return 'Le compte Stripe Connect du propriétaire est manquant.'
  if (!getStripePublishableKey()) return 'La clé Stripe publique est absente. Vérifiez VITE_STRIPE_PUBLISHABLE_KEY.'
  return null
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim()
  }
  return fallback
}

async function mountPaymentElement(clientSecret: string) {
  stripe = await loadStripeClient()
  if (!stripe) {
    throw new Error('Le client Stripe ne peut pas être initialisé. Vérifiez VITE_STRIPE_PUBLISHABLE_KEY.')
  }

  await nextTick()
  const mountNode = paymentElementMount.value
  if (!mountNode) {
    throw new Error('Le module de paiement ne peut pas être affiché pour le moment.')
  }

  stripeElements = stripe.elements({
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  })

  paymentElement = stripeElements.create('payment', {
    layout: {
      type: 'tabs',
      defaultCollapsed: false,
    },
  })
  paymentElement.mount(mountNode)
}

async function preparePaymentIntent() {
  const sequence = ++intentRequestSequence
  paymentIntentError.value = null
  paymentIntentId.value = null
  resetPaymentElement()

  if (reservationError.value) {
    paymentIntentError.value = reservationError.value
    return
  }

  if (paymentOptionError.value) {
    paymentIntentError.value = paymentOptionError.value
    return
  }

  if (!isChoiceAllowed(paymentChoice.value)) {
    paymentIntentError.value = resolveChoiceBlockedReason(paymentChoice.value)
    return
  }

  const setupError = getPaymentSetupError()
  if (setupError) {
    paymentIntentError.value = setupError
    return
  }

  const breakdown = selectedBreakdown.value
  if (breakdown.chargeNowAmount <= 0) {
    paymentIntentError.value = 'Le montant à payer immédiatement doit être supérieur à 0.'
    return
  }

  isPreparingPayment.value = true

  try {
    const session = await createStripePaymentIntent({
      listingId: props.listingId.trim(),
      connectedAccountId: (props.connectedAccountId ?? '').trim(),
      reservation: props.reservation,
      breakdown,
      currency: 'eur',
      metadata: buildStripeReservationMetadata({
        listingId: props.listingId.trim(),
        reservation: props.reservation,
        breakdown,
        paymentRules: paymentRules.value,
      }),
    })

    if (sequence !== intentRequestSequence) return

    paymentIntentId.value = session.id
    paymentIntentCurrency.value = session.currency
    await mountPaymentElement(session.clientSecret)
  } catch (error) {
    if (sequence !== intentRequestSequence) return
    console.error('[Checkout] prepare payment intent failed', error)
    paymentIntentError.value = resolveErrorMessage(error, 'Impossible de préparer le paiement Stripe.')
  } finally {
    if (sequence === intentRequestSequence) {
      isPreparingPayment.value = false
    }
  }
}

async function confirmCheckout() {
  if (!canSubmit.value) return
  if (!isChoiceAllowed(paymentChoice.value)) {
    paymentIntentError.value = resolveChoiceBlockedReason(paymentChoice.value)
    return
  }
  if (!stripe || !stripeElements || !paymentIntentId.value) {
    paymentIntentError.value = 'Le paiement n\'est pas prêt. Réessayez dans quelques secondes.'
    return
  }

  isConfirmingPayment.value = true
  paymentIntentError.value = null

  try {
    const result = await stripe.confirmPayment({
      elements: stripeElements,
      confirmParams: {
        return_url: getStripePaymentReturnUrl(),
      },
      redirect: 'if_required',
    })

    if (result.error) {
      paymentIntentError.value = result.error.message ?? 'Le paiement a été refusé.'
      return
    }

    const paymentIntent = result.paymentIntent
    if (!paymentIntent) {
      paymentIntentError.value = 'Confirmation Stripe incomplète. Aucun PaymentIntent retourné.'
      return
    }

    if (!ACCEPTED_PAYMENT_INTENT_STATUSES.has(paymentIntent.status)) {
      paymentIntentError.value = `Le paiement Stripe est dans un état non valide (${paymentIntent.status}).`
      return
    }

    emit('confirm', {
      travelerMessage: travelerMessage.value.trim(),
      paymentChoice: selectedBreakdown.value.choice,
      payment: {
        breakdown: selectedBreakdown.value,
        paymentIntentId: paymentIntent.id,
        paymentIntentStatus: paymentIntent.status,
        currency: paymentIntent.currency || paymentIntentCurrency.value,
        connectedAccountId: (props.connectedAccountId ?? '').trim(),
      },
    })
  } catch (error) {
    console.error('[Checkout] confirm payment failed', error)
    paymentIntentError.value = resolveErrorMessage(error, 'Impossible de confirmer le paiement Stripe.')
  } finally {
    isConfirmingPayment.value = false
  }
}

watch(
  () => [
    props.listingId,
    props.connectedAccountId,
    props.reservation.startISO,
    props.reservation.endISO,
    props.reservation.nights,
    props.reservation.total,
    paymentChoice.value,
    paymentRules.value.mode,
    paymentRules.value.depositPercent,
    paymentRules.value.balance.type,
    paymentRules.value.balance.days,
    allowedPaymentChoices.value.join('|'),
    reservationError.value,
    paymentOptionError.value,
  ],
  () => {
    void preparePaymentIntent()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  intentRequestSequence += 1
  resetPaymentElement()
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
        <ChevronLeft :size="20" />
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
          :class="{ 'is-selected': paymentChoice === 'full', 'is-disabled': !isChoiceAllowed('full') }"
        >
          <input
            v-model="paymentChoice"
            type="radio"
            value="full"
            :disabled="!isChoiceAllowed('full')"
          />
          <div class="content">
            <p class="title">Payer {{ totalLabel }} maintenant</p>
            <p
              v-if="!isChoiceAllowed('full')"
              class="subtitle"
            >
              {{ resolveChoiceBlockedReason('full') }}
            </p>
          </div>
          <span class="indicator" />
        </label>

        <label
          class="preference-option"
          :class="{ 'is-selected': paymentChoice === 'split', 'is-disabled': !isChoiceAllowed('split') }"
        >
          <input
            v-model="paymentChoice"
            type="radio"
            value="split"
            :disabled="!isChoiceAllowed('split')"
          />
          <div class="content">
            <p class="title">Payer une partie maintenant et l'autre plus tard</p>
            <p
              v-if="isChoiceAllowed('split')"
              class="subtitle"
            >
              {{ splitNowLabel }} à payer aujourd'hui, {{ splitLaterLabel }} à payer le {{ splitDueDateLabel }}.
            </p>
            <p
              v-else
              class="subtitle"
            >
              {{ resolveChoiceBlockedReason('split') }}
            </p>
          </div>
          <span class="indicator" />
        </label>

        <label
          class="preference-option"
          :class="{ 'is-selected': paymentChoice === 'cash', 'is-disabled': !isChoiceAllowed('cash') }"
        >
          <input
            v-model="paymentChoice"
            type="radio"
            value="cash"
            :disabled="!isChoiceAllowed('cash')"
          />
          <div class="content">
            <p class="title">Payer en espèce</p>
            <p
              v-if="isChoiceAllowed('cash')"
              class="subtitle"
            >
              {{ cashNowLabel }} à payer aujourd'hui, {{ cashLaterLabel }} en especes le {{ cashDueDateLabel }}.
            </p>
            <p
              v-else
              class="subtitle"
            >
              {{ resolveChoiceBlockedReason('cash') }}
            </p>
          </div>
          <span class="indicator" />
        </label>
      </div>
      <p
        v-if="paymentOptionError || reservationError"
        class="payment-rule-error"
      >
        {{ paymentOptionError ?? reservationError }}
      </p>
    </section>

    <section class="checkout-section">
      <h3>Paiement sécurisé Stripe</h3>
      <div class="payment-brands">
        <span
          v-for="brand in paymentBrands"
          :key="brand"
          class="brand"
        >
          {{ brand }}
        </span>
      </div>

      <div class="payment-fields">
        <p class="payment-summary">
          <Lock :size="14" />
          <span>{{ selectedChargeNowLabel }} débité maintenant</span>
          <span v-if="selectedBreakdown.deferredAmount > 0">
            · {{ selectedDeferredLabel }}
            <template v-if="selectedBreakdown.deferredMode === 'cash'"> en espèces à l arrivée</template>
            <template v-else> à payer le {{ selectedDueDateLabel }}</template>
          </span>
        </p>

        <div
          v-if="reservationError || paymentOptionError"
          class="payment-placeholder"
        >
          {{ reservationError ?? paymentOptionError }}
        </div>
        <div
          v-else-if="isPreparingPayment"
          class="payment-placeholder"
        >
          Initialisation sécurisée du module Stripe...
        </div>
        <div
          v-else
          ref="paymentElementMount"
          class="payment-element"
        />

        <p
          v-if="paymentIntentError"
          class="payment-error"
        >
          {{ paymentIntentError }}
        </p>
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
            <button
              type="button"
              @click="toggleTravelerMessage"
            >
              {{ travelerMessageCtaLabel }}
            </button>
          </div>
        </div>
        <transition name="info-expand">
          <div
            v-if="travelerMessageOpen"
            class="traveler-message-field"
          >
            <label for="traveler-message">Message à l'hôte</label>
            <textarea
              id="traveler-message"
              v-model="travelerMessage"
              rows="4"
              maxlength="1200"
              placeholder="Ex : Nous arrivons vers 19h, merci de nous confirmer l’accès."
            />
          </div>
        </transition>
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
        , Politique Airbnb de remplacement d'hébergement et de remboursement et je donne mon accord pour qu'Airbnb débite mon mode de paiement si je suis responsable de dommages. Conditions de paiement entre vous et Airbnb Payments Luxembourg S.A.
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
        <button
          type="button"
          :disabled="!canSubmit"
          @click="confirmCheckout"
        >
          {{ submitLabel }}
        </button>
      </div>
      <p
        v-if="props.submitError"
        class="checkout-error"
      >
        {{ props.submitError }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Checkout/checkout.scss';
</style>
