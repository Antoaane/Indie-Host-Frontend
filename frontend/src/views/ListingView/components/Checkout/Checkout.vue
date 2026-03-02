<!-- File: src/views/ListingView/components/Checkout/Checkout.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  Lock,
  MessageCircle,
  ShieldCheck,
  Star,
  UserRound,
  Wallet,
} from 'lucide-vue-next'
import type {
  Stripe,
  StripeCardCvcElement,
  StripeCardExpiryElement,
  StripeCardNumberElement,
  StripeElements,
} from '@stripe/stripe-js'

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
import {
  getStripePublishableKey,
  isStripeCheckoutOfflineModeEnabled,
  loadStripeClient,
} from '@/domain/payments/stripeClient'

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

type ProgressSectionKey = 'information' | 'reminder' | 'final'

const ACCEPTED_PAYMENT_INTENT_STATUSES = new Set([
  'succeeded',
  'processing',
  'requires_capture',
])
const OFFLINE_CONNECTED_ACCOUNT_ID = 'acct_offline_demo'
const OFFLINE_PAYMENT_INTENT_STATUS = 'succeeded'

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
const travelerMessage = ref('')
const travelerPhone = ref('')
const paymentIntentError = ref<string | null>(null)
const isPreparingPayment = ref(false)
const isConfirmingPayment = ref(false)
const cardNumberElementMount = ref<HTMLDivElement | null>(null)
const cardExpiryElementMount = ref<HTMLDivElement | null>(null)
const cardCvcElementMount = ref<HTMLDivElement | null>(null)
const paymentIntentId = ref<string | null>(null)
const paymentIntentClientSecret = ref<string | null>(null)
const paymentIntentCurrency = ref('eur')
const cardholderName = ref('')
const offlineCardNumber = ref('')
const offlineCardExpiry = ref('')
const offlineCardCvc = ref('')
const hasUnlockedPostPaymentSections = ref(false)
const hasAcknowledgedReminder = ref(false)
const isStripeOfflineMode = isStripeCheckoutOfflineModeEnabled()
const stripeCardInputError = ref<string | null>(null)
const stripeCardFormState = reactive({
  numberComplete: false,
  expiryComplete: false,
  cvcComplete: false,
})

let stripe: Stripe | null = null
let stripeElements: StripeElements | null = null
let stripeCardNumberElement: StripeCardNumberElement | null = null
let stripeCardExpiryElement: StripeCardExpiryElement | null = null
let stripeCardCvcElement: StripeCardCvcElement | null = null
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

watch(
  [
    cardholderName,
    offlineCardNumber,
    offlineCardExpiry,
    offlineCardCvc,
  ],
  () => {
    if (!paymentIntentError.value) return
    paymentIntentError.value = null
  },
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

const paymentSectionTitle = 'Paiement sécurisé Stripe'
const isPaymentReady = computed(() => (
  isStripeOfflineMode
    ? Boolean(paymentIntentId.value)
    : Boolean(
      stripe &&
      stripeElements &&
      stripeCardNumberElement &&
      stripeCardExpiryElement &&
      stripeCardCvcElement &&
      paymentIntentId.value &&
      paymentIntentClientSecret.value,
    )
))
const stripeCardFormValidationError = computed(() => {
  if (isStripeOfflineMode) return null
  if (!cardholderName.value.trim()) return 'Saisissez le nom du titulaire de la carte.'
  if (stripeCardInputError.value) return stripeCardInputError.value
  if (!stripeCardFormState.numberComplete || !stripeCardFormState.expiryComplete || !stripeCardFormState.cvcComplete) {
    return 'Complétez les informations de carte bancaire.'
  }
  return null
})
const offlineCardFormValidationError = computed(() => {
  if (!isStripeOfflineMode) return null
  if (!cardholderName.value.trim()) return 'Saisissez le nom du titulaire de la carte.'

  const cardNumberDigits = offlineCardNumber.value.replace(/\D/g, '')
  if (cardNumberDigits.length < 13 || cardNumberDigits.length > 19) {
    return 'Le numéro de carte est invalide.'
  }

  const expiryMatch = offlineCardExpiry.value.trim().match(/^(\d{2})\s*\/\s*(\d{2})$/)
  if (!expiryMatch) {
    return "La date d'expiration doit être au format MM/AA."
  }

  const expiryMonth = Number(expiryMatch[1])
  const expiryYear = Number(expiryMatch[2])
  if (expiryMonth < 1 || expiryMonth > 12) {
    return "Le mois d'expiration est invalide."
  }

  const now = new Date()
  const currentYear = now.getFullYear() % 100
  const currentMonth = now.getMonth() + 1
  if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
    return 'La carte est expirée.'
  }

  const cvcDigits = offlineCardCvc.value.replace(/\D/g, '')
  if (cvcDigits.length < 3 || cvcDigits.length > 4) {
    return 'Le code CVC est invalide.'
  }

  return null
})
const cardFormValidationError = computed(() => (
  isStripeOfflineMode
    ? offlineCardFormValidationError.value
    : stripeCardFormValidationError.value
))
const paymentErrorMessage = computed(() => {
  if (paymentIntentError.value) return paymentIntentError.value
  if (reservationError.value || paymentOptionError.value || isPreparingPayment.value || !isPaymentReady.value) return null
  return cardFormValidationError.value
})
const isCardFormReady = computed(() => !cardFormValidationError.value)
const isCardDetailsEntered = computed(() => {
  if (!cardholderName.value.trim()) return false

  if (isStripeOfflineMode) {
    return Boolean(
      offlineCardNumber.value.trim() &&
      offlineCardExpiry.value.trim() &&
      offlineCardCvc.value.trim(),
    )
  }

  return (
    stripeCardFormState.numberComplete &&
    stripeCardFormState.expiryComplete &&
    stripeCardFormState.cvcComplete
  )
})
const shouldRevealPostPaymentSections = computed(() => hasUnlockedPostPaymentSections.value)
const canAccessInformationStep = computed(() => shouldRevealPostPaymentSections.value)
const isInformationStepComplete = computed(() => Boolean(travelerPhone.value.trim()))
const canAccessReminderStep = computed(() => canAccessInformationStep.value && isInformationStepComplete.value)
const canAccessFinalStep = computed(() => canAccessReminderStep.value && hasAcknowledgedReminder.value)
const openedProgressSection = ref<ProgressSectionKey | null>(null)
const isInformationSectionOpen = computed(() => openedProgressSection.value === 'information')
const isReminderSectionOpen = computed(() => openedProgressSection.value === 'reminder')
const isFinalSectionOpen = computed(() => openedProgressSection.value === 'final')
const canSubmit = computed(() =>
  !reservationError.value &&
  !paymentOptionError.value &&
  !props.isSubmitting &&
  !isPreparingPayment.value &&
  !isConfirmingPayment.value &&
  isPaymentReady.value &&
  isCardFormReady.value &&
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

function toggleProgressSection(section: ProgressSectionKey) {
  openedProgressSection.value = openedProgressSection.value === section ? null : section
}

function resetStripeCardElementState() {
  stripeCardFormState.numberComplete = false
  stripeCardFormState.expiryComplete = false
  stripeCardFormState.cvcComplete = false
  stripeCardInputError.value = null
}

function resetPaymentElement() {
  if (stripeCardNumberElement) {
    stripeCardNumberElement.unmount()
    stripeCardNumberElement.destroy()
    stripeCardNumberElement = null
  }

  if (stripeCardExpiryElement) {
    stripeCardExpiryElement.unmount()
    stripeCardExpiryElement.destroy()
    stripeCardExpiryElement = null
  }

  if (stripeCardCvcElement) {
    stripeCardCvcElement.unmount()
    stripeCardCvcElement.destroy()
    stripeCardCvcElement = null
  }

  stripeElements = null
  paymentIntentClientSecret.value = null
  resetStripeCardElementState()
}

function resolveConnectedAccountId(): string {
  const connectedAccountId = (props.connectedAccountId ?? '').trim()
  if (connectedAccountId) return connectedAccountId
  return isStripeOfflineMode ? OFFLINE_CONNECTED_ACCOUNT_ID : ''
}

function createOfflinePaymentIntentId(): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36)
  return `pi_offline_${suffix}`
}

function getPaymentSetupError(): string | null {
  if (!props.listingId?.trim()) return "Impossible de déterminer l'annonce pour le paiement."
  if (isStripeOfflineMode) return null
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
  const numberMountNode = cardNumberElementMount.value
  const expiryMountNode = cardExpiryElementMount.value
  const cvcMountNode = cardCvcElementMount.value
  if (!numberMountNode || !expiryMountNode || !cvcMountNode) {
    throw new Error('Le module de paiement ne peut pas être affiché pour le moment.')
  }

  resetStripeCardElementState()
  stripeElements = stripe.elements({
    appearance: {
      theme: 'stripe',
    },
  })

  stripeCardNumberElement = stripeElements.create('cardNumber', {
    placeholder: '1234 1234 1234 1234',
    showIcon: true,
  })
  stripeCardExpiryElement = stripeElements.create('cardExpiry')
  stripeCardCvcElement = stripeElements.create('cardCvc')

  stripeCardNumberElement.on('change', (event) => {
    stripeCardFormState.numberComplete = Boolean(event.complete)
    stripeCardInputError.value = event.error?.message ?? null
    if (paymentIntentError.value) paymentIntentError.value = null
  })
  stripeCardExpiryElement.on('change', (event) => {
    stripeCardFormState.expiryComplete = Boolean(event.complete)
    stripeCardInputError.value = event.error?.message ?? null
    if (paymentIntentError.value) paymentIntentError.value = null
  })
  stripeCardCvcElement.on('change', (event) => {
    stripeCardFormState.cvcComplete = Boolean(event.complete)
    stripeCardInputError.value = event.error?.message ?? null
    if (paymentIntentError.value) paymentIntentError.value = null
  })

  stripeCardNumberElement.mount(numberMountNode)
  stripeCardExpiryElement.mount(expiryMountNode)
  stripeCardCvcElement.mount(cvcMountNode)

  paymentIntentClientSecret.value = clientSecret
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
    if (isStripeOfflineMode) {
      await new Promise((resolve) => setTimeout(resolve, 180))
      if (sequence !== intentRequestSequence) return
      paymentIntentId.value = createOfflinePaymentIntentId()
      paymentIntentCurrency.value = 'eur'
      return
    }

    const session = await createStripePaymentIntent({
      listingId: props.listingId.trim(),
      connectedAccountId: resolveConnectedAccountId(),
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
  isConfirmingPayment.value = true
  paymentIntentError.value = null

  try {
    if (isStripeOfflineMode) {
      await new Promise((resolve) => setTimeout(resolve, 260))

      emit('confirm', {
        travelerMessage: travelerMessage.value.trim(),
        paymentChoice: selectedBreakdown.value.choice,
        payment: {
          breakdown: selectedBreakdown.value,
          paymentIntentId: paymentIntentId.value ?? createOfflinePaymentIntentId(),
          paymentIntentStatus: OFFLINE_PAYMENT_INTENT_STATUS,
          currency: paymentIntentCurrency.value || 'eur',
          connectedAccountId: resolveConnectedAccountId(),
        },
      })
      return
    }

    if (!stripe || !stripeElements || !paymentIntentId.value || !paymentIntentClientSecret.value || !stripeCardNumberElement) {
      paymentIntentError.value = 'Le paiement n\'est pas prêt. Réessayez dans quelques secondes.'
      return
    }

    const result = await stripe.confirmCardPayment(
      paymentIntentClientSecret.value,
      {
        payment_method: {
          card: stripeCardNumberElement,
          billing_details: {
            name: cardholderName.value.trim(),
          },
        },
      },
      {
        handleActions: true,
      },
    )

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
        connectedAccountId: resolveConnectedAccountId(),
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
  isCardDetailsEntered,
  (isEntered) => {
    if (isEntered) hasUnlockedPostPaymentSections.value = true
  },
  { immediate: true },
)

watch(
  canAccessReminderStep,
  (canAccess) => {
    if (!canAccess) hasAcknowledgedReminder.value = false
  },
  { immediate: true },
)

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
      <h3 class="progress-section-title">
        <span class="progress-step-indicator is-active">1</span>
        <Wallet
          :size="16"
          class="section-title-icon"
          aria-hidden="true"
        />
        <span class="section-title-label">Vos préférences</span>
      </h3>
      <div
        class="preference-card"
        role="radiogroup"
        aria-label="Options de paiement" title="Options de paiement"
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
      <h3 class="progress-section-title">
        <span
          class="progress-step-indicator"
          :class="{ 'is-complete': canAccessInformationStep, 'is-active': !canAccessInformationStep }"
        >
          {{ canAccessInformationStep ? '✓' : '2' }}
        </span>
        <ShieldCheck
          :size="16"
          class="section-title-icon"
          aria-hidden="true"
        />
        <span class="section-title-label">{{ paymentSectionTitle }}</span>
      </h3>
      <div
        v-if="!isStripeOfflineMode"
        class="payment-brands"
      >
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
          v-else-if="isStripeOfflineMode"
          class="payment-offline"
        >
          <div class="payment-brands">
            <span
              v-for="brand in paymentBrands"
              :key="brand"
              class="brand"
            >
              {{ brand }}
            </span>
          </div>
          <label class="payment-offline-field">
            <span>Nom du titulaire</span>
            <input
              v-model="cardholderName"
              type="text"
              autocomplete="cc-name"
              placeholder="Nom Prénom"
            />
          </label>
          <div class="payment-offline-grid">
            <label class="payment-offline-field">
              <span>Numéro de carte</span>
              <input
                v-model="offlineCardNumber"
                type="text"
                inputmode="numeric"
                autocomplete="cc-number"
                placeholder="4242 4242 4242 4242"
              />
            </label>
            <label class="payment-offline-field">
              <span>Expiration</span>
              <input
                v-model="offlineCardExpiry"
                type="text"
                inputmode="numeric"
                autocomplete="cc-exp"
                placeholder="MM/AA"
              />
            </label>
            <label class="payment-offline-field">
              <span>CVC</span>
              <input
                v-model="offlineCardCvc"
                type="text"
                inputmode="numeric"
                autocomplete="cc-csc"
                placeholder="123"
              />
            </label>
          </div>
        </div>
        <div
          v-else
          class="payment-card-form"
        >
          <label class="payment-card-field">
            <span>Nom du titulaire</span>
            <input
              v-model="cardholderName"
              type="text"
              autocomplete="cc-name"
              placeholder="Nom Prénom"
            />
          </label>
          <label class="payment-card-field">
            <span>Numéro de carte</span>
            <div
              ref="cardNumberElementMount"
              class="payment-element"
            />
          </label>
          <div class="payment-card-grid">
            <label class="payment-card-field">
              <span>Expiration</span>
              <div
                ref="cardExpiryElementMount"
                class="payment-element"
              />
            </label>
            <label class="payment-card-field">
              <span>CVC</span>
              <div
                ref="cardCvcElementMount"
                class="payment-element"
              />
            </label>
          </div>
        </div>

        <p
          v-if="paymentErrorMessage"
          class="payment-error"
        >
          {{ paymentErrorMessage }}
        </p>
        <p
          v-if="!shouldRevealPostPaymentSections"
          class="payment-reveal-hint"
        >
          Complétez les informations de carte pour afficher les étapes suivantes.
        </p>
      </div>
    </section>

    <section
      class="checkout-section checkout-progress-section"
      :class="{ 'is-locked': !canAccessInformationStep }"
    >
      <h3 class="progress-section-title">
        <button
          type="button"
          class="progress-section-toggle"
          :aria-expanded="isInformationSectionOpen"
          @click="toggleProgressSection('information')"
        >
          <span
            class="progress-step-indicator"
            :class="{
              'is-complete': canAccessReminderStep,
              'is-active': canAccessInformationStep && !canAccessReminderStep,
              'is-locked': !canAccessInformationStep,
            }"
          >
            {{ canAccessReminderStep ? '✓' : '3' }}
          </span>
          <UserRound
            :size="16"
            class="section-title-icon"
            aria-hidden="true"
          />
          <span class="section-title-label">Informations nécessaires</span>
          <ChevronDown
            :size="16"
            class="progress-step-chevron"
            :class="{ 'is-open': isInformationSectionOpen }"
          />
        </button>
      </h3>
      <transition name="checkout-step-expand">
        <div
          v-if="isInformationSectionOpen"
          class="progress-section-body"
          :class="{ 'is-disabled': !canAccessInformationStep }"
        >
          <div class="info-list">
            <div class="traveler-message-field">
              <label for="traveler-message">Dites nous-en un peu plus sur vous</label>
              <p class="field-help">Donnez la raison de votre voyage, votre nombre, etc.</p>
              <textarea
                id="traveler-message"
                v-model="travelerMessage"
                :disabled="!canAccessInformationStep"
                rows="4"
                maxlength="1200"
                placeholder="Ex : Nous arrivons vers 19h, merci de nous confirmer l’accès."
              />
            </div>
            <div class="phone-input-field">
              <label for="traveler-phone">Votre numéro de téléphone</label>
              <input
                id="traveler-phone"
                v-model="travelerPhone"
                :disabled="!canAccessInformationStep"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                placeholder="Ex : +33 6 12 34 56 78"
              />
              <p class="field-help">Pour vous transmettre des informations complémentaires si besoin.</p>
            </div>
          </div>
        </div>
      </transition>
    </section>

    <section
      class="checkout-section checkout-progress-section"
      :class="{ 'is-locked': !canAccessReminderStep }"
    >
      <h3 class="progress-section-title">
        <button
          type="button"
          class="progress-section-toggle"
          :aria-expanded="isReminderSectionOpen"
          @click="toggleProgressSection('reminder')"
        >
          <span
            class="progress-step-indicator"
            :class="{
              'is-complete': canAccessFinalStep,
              'is-active': canAccessReminderStep && !canAccessFinalStep,
              'is-locked': !canAccessReminderStep,
            }"
          >
            {{ canAccessFinalStep ? '✓' : '4' }}
          </span>
          <MessageCircle
            :size="16"
            class="section-title-icon"
            aria-hidden="true"
          />
          <span class="section-title-label">Un petit rappel</span>
          <ChevronDown
            :size="16"
            class="progress-step-chevron"
            :class="{ 'is-open': isReminderSectionOpen }"
          />
        </button>
      </h3>
      <transition name="checkout-step-expand">
        <div
          v-if="isReminderSectionOpen"
          class="progress-section-body"
          :class="{ 'is-disabled': !canAccessReminderStep }"
        >
          <p class="section-text">
            Votre hôte a mis tout son coeur pour que vous passiez un bon moment. De votre côté, un petit geste :
            <strong>veillez à prendre soin du lieu et respectez les consignes.</strong>
            De cette façon, l'expérience reste top pour tout le monde.
          </p>
          <label class="progress-check-field">
            <input
              v-model="hasAcknowledgedReminder"
              :disabled="!canAccessReminderStep"
              type="checkbox"
            />
            <span>J'ai lu ce rappel et je m'engage à respecter les consignes.</span>
          </label>
        </div>
      </transition>
    </section>

    <section
      class="checkout-section checkout-progress-section"
      :class="{ 'is-locked': !canAccessFinalStep }"
    >
      <h3 class="progress-section-title">
        <button
          type="button"
          class="progress-section-toggle"
          :aria-expanded="isFinalSectionOpen"
          @click="toggleProgressSection('final')"
        >
          <span
            class="progress-step-indicator"
            :class="{
              'is-active': canAccessFinalStep,
              'is-locked': !canAccessFinalStep,
            }"
          >
            5
          </span>
          <CalendarCheck
            :size="16"
            class="section-title-icon"
            aria-hidden="true"
          />
          <span class="section-title-label">C'est parti</span>
          <ChevronDown
            :size="16"
            class="progress-step-chevron"
            :class="{ 'is-open': isFinalSectionOpen }"
          />
        </button>
      </h3>
      <transition name="checkout-step-expand">
        <div
          v-if="isFinalSectionOpen"
          class="progress-section-body"
          :class="{ 'is-disabled': !canAccessFinalStep }"
        >
          <p class="section-text">
            En cliquant sur le bouton ci-dessous, j'accepte :
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
            .
          </p>
          <p class="section-text">
            IndieHost est un outil de réservation et de paiement, pas une plateforme de location. L'hôte reste responsable des conditions du séjour et de la gestion des éventuels dommages.
          </p>
          <p class="section-text">
            J'accepte aussi les
            <button
              type="button"
              class="link"
            >
              Conditions de service
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
        </div>
      </transition>
    </section>

    <div
      v-if="canAccessFinalStep"
      class="checkout-cta"
    >
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
