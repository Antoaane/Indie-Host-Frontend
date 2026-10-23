<!-- File: src/views/ListingView/components/Checkout/Checkout.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useUser } from '@clerk/vue'
import {
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  Lock,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  Star,
  UserRound,
  Wallet,
} from 'lucide-vue-next'
import type {
  Stripe,
  StripeElements,
  StripePaymentElement,
} from '@stripe/stripe-js'

import type { ListingParsed } from '@/views/ListingView/types/listing'
import type { ReservationPayload } from '@/views/ListingView/types/reservation'
import type { CheckoutConfirmationPayload } from '@/views/ListingView/types/checkout'
import { createStripePaymentIntent } from '@/domain/api/stripePayments'
import {
  buildStripeReservationMetadata,
  resolveCheckoutPaymentBreakdown,
  type CheckoutPaymentChoice,
} from '@/domain/payments/checkoutPayment'
import {
  resolveCheckoutPaymentChoice,
  validateReservationAgainstRules,
} from '@/domain/listings/reservationRules'
import { describeCancellationPolicy, summarizeCancellationPolicy } from '@/domain/listings/cancellationPolicy'
import {
  getStripePublishableKey,
  isStripeCheckoutOfflineModeEnabled,
  loadStripeClient,
} from '@/domain/payments/stripeClient'
import { sanitizeHtml } from '@/utils/sanitizeHtml'

type ProgressSectionKey = 'information' | 'reminder' | 'final'

// Au-delà de cette longueur, le règlement est replié derrière « Voir le règlement » avec un aperçu.
const HOUSE_RULES_EXCERPT_LENGTH = 140
const HOUSE_RULES_CONTENT_ID = 'checkout-house-rules-content'

const ACCEPTED_PAYMENT_INTENT_STATUSES = new Set([
  'succeeded',
  'processing',
  'requires_capture',
])
const OFFLINE_CONNECTED_ACCOUNT_ID = 'acct_offline_demo'
const OFFLINE_PAYMENT_INTENT_STATUS = 'succeeded'
// Vérification volontairement simple : l'adresse reçoit la confirmation de réservation (support durable).
const TRAVELER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TRAVELER_EMAIL_HELP_ID = 'traveler-email-help'
const TRAVELER_EMAIL_ERROR_ID = 'traveler-email-error'

function normalizeIdentityToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[@\s._-]+/g, '')
    .trim()
}

function isDeprecatedHostIdentity(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = normalizeIdentityToken(value)
  return normalized === 'hote' || normalized === 'host'
}

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
const travelerFirstName = ref('')
const travelerLastName = ref('')
const travelerPhone = ref('')
const travelerEmail = ref('')
const hasTravelerEmailBlurred = ref(false)
const paymentIntentError = ref<string | null>(null)
const isPreparingPayment = ref(false)
const isConfirmingPayment = ref(false)
const paymentElementMount = ref<HTMLDivElement | null>(null)
const paymentIntentId = ref<string | null>(null)
const paymentIntentClientSecret = ref<string | null>(null)
const paymentIntentCurrency = ref('eur')
const paymentIntentConnectedAccountId = ref('')
const cardholderFirstName = ref('')
const cardholderLastName = ref('')
const offlineCardNumber = ref('')
const offlineCardExpiry = ref('')
const offlineCardCvc = ref('')
const hasAcknowledgedReminder = ref(false)
const isStripeOfflineMode = isStripeCheckoutOfflineModeEnabled()
const stripeCardInputError = ref<string | null>(null)
const stripePaymentElementComplete = ref(false)
const isPaymentElementMounted = ref(false)

let stripe: Stripe | null = null
let stripeElements: StripeElements | null = null
let stripePaymentElement: StripePaymentElement | null = null
let intentRequestSequence = 0

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function formatDateLabel(iso?: string | null): string {
  if (!iso) return "le jour d'arrivée"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return "le jour d'arrivée"
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
    : 'Aucune modalité de paiement valide n’est configurée pour cette annonce.',
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
    cardholderFirstName,
    cardholderLastName,
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
  return paymentRules.value.blockedReasons[choice] ?? 'Option non autorisée pour cette annonce.'
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
  const hostName = typeof host?.name === 'string' ? host.name.trim() : ''
  if (!hostName || isDeprecatedHostIdentity(hostName)) return ''
  return `à ${hostName}`
})
const listingLocation = computed(() => {
  const title = props.listing.title
  return `${title.type} - ${title.location.city}, ${title.location.country}`
})
// Qualité du loueur (art. L111-7 Code de la consommation, CGV art. 3) : affichée seulement si l'hôte l'a déclarée.
const hostLegalStatusLine = computed(() => {
  const host = props.listing.hostProfile
  if (host?.legalStatus === 'individual') return 'Vous réservez auprès d’un hôte particulier.'
  if (host?.legalStatus === 'professional') {
    const companyName = host.companyName?.trim()
    return companyName
      ? `Vous réservez auprès d’un hôte professionnel (${companyName}).`
      : 'Vous réservez auprès d’un hôte professionnel.'
  }
  return ''
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
const cardholderFullName = computed(() => `${cardholderFirstName.value.trim()} ${cardholderLastName.value.trim()}`.trim())
const isCardholderNameComplete = computed(() => Boolean(cardholderFirstName.value.trim() && cardholderLastName.value.trim()))
const isPaymentReady = computed(() => (
  isStripeOfflineMode
    ? Boolean(paymentIntentId.value)
    : Boolean(
      isPaymentElementMounted.value &&
      paymentIntentId.value &&
      paymentIntentClientSecret.value,
    )
))
const stripeCardFormValidationError = computed(() => {
  if (isStripeOfflineMode) return null
  if (!isCardholderNameComplete.value) return 'Saisissez le prénom et le nom du titulaire de la carte.'
  if (stripeCardInputError.value) return stripeCardInputError.value
  if (!stripePaymentElementComplete.value) {
    return 'Complétez les informations de paiement Stripe.'
  }
  return null
})
const offlineCardFormValidationError = computed(() => {
  if (!isStripeOfflineMode) return null
  if (!isCardholderNameComplete.value) return 'Saisissez le prénom et le nom du titulaire de la carte.'

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
const isPaymentElementFieldsComplete = computed(() => {
  if (!isPaymentReady.value) return false

  if (isStripeOfflineMode) {
    return Boolean(
      offlineCardNumber.value.trim() &&
      offlineCardExpiry.value.trim() &&
      offlineCardCvc.value.trim(),
    )
  }

  if (stripeCardInputError.value) return false
  return stripePaymentElementComplete.value
})
const isPaymentStepComplete = computed(() => (
  !reservationError.value &&
  !paymentOptionError.value &&
  !isPreparingPayment.value &&
  isPaymentElementFieldsComplete.value
))
const shouldRevealPostPaymentSections = computed(() => isPaymentStepComplete.value)
const canAccessInformationStep = computed(() => isPaymentStepComplete.value)
// E-mail du voyageur : normalisé (trim + minuscules), pré-rempli depuis le compte Clerk s'il est vide.
const normalizedTravelerEmail = computed(() => travelerEmail.value.trim().toLowerCase())
const isTravelerEmailValid = computed(() => TRAVELER_EMAIL_PATTERN.test(normalizedTravelerEmail.value))
// L'erreur n'apparaît qu'après une première sortie du champ, pour ne pas crier pendant la saisie.
const travelerEmailError = computed(() => {
  if (!hasTravelerEmailBlurred.value || isTravelerEmailValid.value) return null
  return 'Saisissez une adresse e-mail valide.'
})
const travelerEmailDescribedBy = computed(() => (
  travelerEmailError.value ? `${TRAVELER_EMAIL_HELP_ID} ${TRAVELER_EMAIL_ERROR_ID}` : TRAVELER_EMAIL_HELP_ID
))

const { user: clerkUser } = useUser()
watch(
  () => clerkUser.value?.primaryEmailAddress?.emailAddress ?? null,
  (primaryEmail) => {
    if (!primaryEmail || travelerEmail.value.trim()) return
    travelerEmail.value = primaryEmail.trim().toLowerCase()
  },
  { immediate: true },
)

const isInformationStepComplete = computed(() => Boolean(
  travelerFirstName.value.trim() &&
  travelerLastName.value.trim() &&
  travelerPhone.value.trim() &&
  isTravelerEmailValid.value,
))
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
  canAccessFinalStep.value &&
  !paymentIntentError.value,
)

// Information précontractuelle : le barème appliqué par l'API à l'annulation, annoncé avant le paiement
// (phrases et libellés partagés avec l'éditeur : domain/listings/cancellationPolicy.ts).
const cancellationRules = computed(() => props.listing.bookings.rules.cancellation)
const cancellationPolicyLabel = computed(() => summarizeCancellationPolicy(cancellationRules.value))
const cancellationRuleLines = computed(() => describeCancellationPolicy(cancellationRules.value))

// Règlement intérieur de l'hôte (`arrival.practical.rules`, HTML Quill) : information précontractuelle,
// lue avant le paiement. La case de l'étape 4 (`hasAcknowledgedReminder`) conditionne déjà l'étape 5 et
// le bouton de paiement : quand un règlement existe, c'est lui que le voyageur accepte.
const houseRules = computed(() => props.listing.houseRules)
const hasHouseRules = computed(() => Boolean(houseRules.value.text))
const houseRulesHtml = computed(() => (hasHouseRules.value ? sanitizeHtml(houseRules.value.html) : ''))
const isHouseRulesShort = computed(() => houseRules.value.text.length <= HOUSE_RULES_EXCERPT_LENGTH)
const houseRulesExcerpt = computed(() => {
  const text = houseRules.value.text
  if (text.length <= HOUSE_RULES_EXCERPT_LENGTH) return text
  const cut = text.slice(0, HOUSE_RULES_EXCERPT_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > HOUSE_RULES_EXCERPT_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
})
const isHouseRulesExpanded = ref(false)
const showHouseRulesContent = computed(() => isHouseRulesShort.value || isHouseRulesExpanded.value)
const houseRulesContentId = HOUSE_RULES_CONTENT_ID

function toggleHouseRules() {
  isHouseRulesExpanded.value = !isHouseRulesExpanded.value
}

const submitLabel = computed(() => {
  if (reservationError.value) return 'Réservation invalide'
  if (paymentOptionError.value) return 'Paiement indisponible'
  if (props.isSubmitting) return 'Validation de la réservation...'
  if (isConfirmingPayment.value) return 'Confirmation du paiement...'
  if (isPreparingPayment.value) return 'Préparation du paiement...'
  return `Confirmer et payer ${selectedChargeNowLabel.value}`
})

function toggleProgressSection(section: ProgressSectionKey) {
  if (section === 'information' && !canAccessInformationStep.value) return
  if (section === 'reminder' && !canAccessReminderStep.value) return
  if (section === 'final' && !canAccessFinalStep.value) return
  openedProgressSection.value = openedProgressSection.value === section ? null : section
}

function resetStripeCardElementState() {
  stripePaymentElementComplete.value = false
  stripeCardInputError.value = null
}

function resetPaymentElement() {
  isPaymentElementMounted.value = false

  if (stripePaymentElement) {
    stripePaymentElement.unmount()
    stripePaymentElement.destroy()
    stripePaymentElement = null
  }

  stripeElements = null
  paymentIntentClientSecret.value = null
  paymentIntentConnectedAccountId.value = ''
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

function resolveConfirmedConnectedAccountId(): string {
  const resolved = paymentIntentConnectedAccountId.value.trim()
  if (resolved) return resolved
  return resolveConnectedAccountId()
}

function getPaymentSetupError(): string | null {
  if (!props.listingId?.trim()) return "Impossible de déterminer l'annonce pour le paiement."
  if (isStripeOfflineMode) return null
  const stripePublishableKey = getStripePublishableKey()
  if (!stripePublishableKey) return 'La clé Stripe publique est absente. Vérifiez VITE_STRIPE_PUBLISHABLE_KEY.'
  if (/X{8,}/.test(stripePublishableKey)) {
    return 'La clé Stripe publique frontend est un placeholder. Remplacez VITE_STRIPE_PUBLISHABLE_KEY par une vraie clé pk_test du même compte Stripe que le backend.'
  }
  return null
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim()
  }
  return fallback
}

function resolvePaymentElementLoadErrorMessage(rawMessage: string): string | null {
  const message = rawMessage.trim()
  if (!message) return null

  const normalized = message.toLowerCase()
  if (normalized.includes('401') || normalized.includes('unauthorized')) {
    return 'Stripe refuse le chargement du module de paiement (401). Vérifiez que VITE_STRIPE_PUBLISHABLE_KEY correspond au même compte Stripe que STRIPE_SECRET_KEY.'
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('blocked_by_client') ||
    normalized.includes('r.stripe.com')
  ) {
    return null
  }

  return message
}

async function mountPaymentElement(clientSecret: string, stripeAccount: string | null) {
  // Paiement direct : le PaymentIntent est créé sur le compte Stripe de l'hôte.
  stripe = await loadStripeClient(stripeAccount)
  if (!stripe) {
    throw new Error('Le client Stripe ne peut pas être initialisé. Vérifiez VITE_STRIPE_PUBLISHABLE_KEY.')
  }

  await nextTick()
  const mountNode = paymentElementMount.value
  if (!mountNode) {
    throw new Error('Le module de paiement ne peut pas être affiché pour le moment.')
  }

  resetStripeCardElementState()
  stripeElements = stripe.elements({
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  })

  stripePaymentElement = stripeElements.create('payment', {
    layout: 'tabs',
    fields: {
      billingDetails: {
        name: 'never',
      },
    },
  })
  stripePaymentElement.on('change', (event) => {
    const changeEventError = (event as unknown as { error?: { message?: string } }).error
    stripePaymentElementComplete.value = Boolean(event.complete)
    stripeCardInputError.value = changeEventError?.message ?? null
    if (paymentIntentError.value) paymentIntentError.value = null
  })
  stripePaymentElement.on('loaderror', (event) => {
    console.error('[Checkout] payment element loaderror', event.error)
    const blockingMessage = resolvePaymentElementLoadErrorMessage(event.error.message ?? '')
    if (blockingMessage) {
      paymentIntentError.value = blockingMessage
    }
  })
  stripePaymentElement.mount(mountNode)
  isPaymentElementMounted.value = true

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
      paymentIntentConnectedAccountId.value = resolveConnectedAccountId()
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
    paymentIntentConnectedAccountId.value = session.connectedAccountId || resolveConnectedAccountId()
    isPreparingPayment.value = false
    await nextTick()
    await mountPaymentElement(session.clientSecret, paymentIntentConnectedAccountId.value || null)
  } catch (error) {
    if (sequence !== intentRequestSequence) return
    console.error('[Checkout] prepare payment intent failed', error)
    paymentIntentError.value = resolveErrorMessage(error, 'Impossible de préparer le paiement Stripe.')
  } finally {
    if (sequence === intentRequestSequence && isPreparingPayment.value) {
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
        travelerContact: {
          firstName: travelerFirstName.value.trim(),
          lastName: travelerLastName.value.trim(),
          phone: travelerPhone.value.trim(),
          email: normalizedTravelerEmail.value,
        },
        cardholder: {
          firstName: cardholderFirstName.value.trim(),
          lastName: cardholderLastName.value.trim(),
          fullName: cardholderFullName.value,
        },
        paymentChoice: selectedBreakdown.value.choice,
        payment: {
          breakdown: selectedBreakdown.value,
          paymentIntentId: paymentIntentId.value ?? createOfflinePaymentIntentId(),
          paymentIntentStatus: OFFLINE_PAYMENT_INTENT_STATUS,
          currency: paymentIntentCurrency.value || 'eur',
          connectedAccountId: resolveConfirmedConnectedAccountId(),
        },
      })
      return
    }

    if (!stripe || !stripeElements || !paymentIntentId.value || !paymentIntentClientSecret.value || !stripePaymentElement) {
      paymentIntentError.value = 'Le paiement n\'est pas prêt. Réessayez dans quelques secondes.'
      return
    }

    const submitResult = await stripeElements.submit()
    if (submitResult.error) {
      paymentIntentError.value = submitResult.error.message ?? 'Les informations de paiement sont incomplètes.'
      return
    }

    const result = await stripe.confirmPayment({
      elements: stripeElements,
      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: cardholderFullName.value,
          },
        },
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
      travelerContact: {
        firstName: travelerFirstName.value.trim(),
        lastName: travelerLastName.value.trim(),
        phone: travelerPhone.value.trim(),
        email: normalizedTravelerEmail.value,
      },
      cardholder: {
        firstName: cardholderFirstName.value.trim(),
        lastName: cardholderLastName.value.trim(),
        fullName: cardholderFullName.value,
      },
      paymentChoice: selectedBreakdown.value.choice,
      payment: {
        breakdown: selectedBreakdown.value,
        paymentIntentId: paymentIntent.id,
        paymentIntentStatus: paymentIntent.status,
        currency: paymentIntent.currency || paymentIntentCurrency.value,
        connectedAccountId: resolveConfirmedConnectedAccountId(),
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
  canAccessReminderStep,
  (canAccess) => {
    if (!canAccess) hasAcknowledgedReminder.value = false
  },
  { immediate: true },
)

watch(
  [
    canAccessInformationStep,
    isInformationStepComplete,
    canAccessFinalStep,
  ],
  () => {
    if (!canAccessInformationStep.value) {
      openedProgressSection.value = null
      return
    }
    if (!isInformationStepComplete.value) {
      openedProgressSection.value = 'information'
      return
    }
    if (!canAccessFinalStep.value) {
      openedProgressSection.value = 'reminder'
      return
    }
    openedProgressSection.value = 'final'
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
          <Star
            :size="14"
            aria-hidden="true"
          />
          <span>{{ listingRating.toFixed(2) }}<span class="sr-only"> sur 5</span></span>
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
              {{ cashNowLabel }} à payer aujourd'hui, {{ cashLaterLabel }} en espèces le {{ cashDueDateLabel }}.
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
          <div class="payment-cardholder-grid">
            <label class="payment-offline-field">
              <span>Prénom du titulaire</span>
              <input
                v-model="cardholderFirstName"
                type="text"
                autocomplete="cc-given-name"
                placeholder="Prénom"
              />
            </label>
            <label class="payment-offline-field">
              <span>Nom du titulaire</span>
              <input
                v-model="cardholderLastName"
                type="text"
                autocomplete="cc-family-name"
                placeholder="Nom"
              />
            </label>
          </div>
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
          <div class="payment-cardholder-grid">
            <label class="payment-card-field">
              <span>Prénom du titulaire</span>
              <input
                v-model="cardholderFirstName"
                type="text"
                autocomplete="cc-given-name"
                placeholder="Prénom"
              />
            </label>
            <label class="payment-card-field">
              <span>Nom du titulaire</span>
              <input
                v-model="cardholderLastName"
                type="text"
                autocomplete="cc-family-name"
                placeholder="Nom"
              />
            </label>
          </div>
          <div class="payment-card-field">
            <span>Détails du moyen de paiement</span>
            <div class="payment-element-shell">
              <div
                ref="paymentElementMount"
                class="payment-element"
              />
            </div>
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
          Complétez le formulaire de paiement Stripe pour afficher les étapes suivantes.
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
          :disabled="!canAccessInformationStep"
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
            <div class="traveler-identity-grid">
              <label class="identity-input-field">
                <span>Prénom</span>
                <input
                  v-model="travelerFirstName"
                  :disabled="!canAccessInformationStep"
                  type="text"
                  autocomplete="given-name"
                  placeholder="Ex : Antoine"
                />
              </label>
              <label class="identity-input-field">
                <span>Nom</span>
                <input
                  v-model="travelerLastName"
                  :disabled="!canAccessInformationStep"
                  type="text"
                  autocomplete="family-name"
                  placeholder="Ex : Dupont"
                />
              </label>
            </div>
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
            <div class="email-input-field">
              <label for="traveler-email">Adresse e-mail</label>
              <input
                id="traveler-email"
                v-model="travelerEmail"
                :disabled="!canAccessInformationStep"
                type="email"
                inputmode="email"
                autocomplete="email"
                required
                autocapitalize="off"
                spellcheck="false"
                placeholder="Ex : antoine.dupont@exemple.fr"
                :aria-invalid="travelerEmailError ? 'true' : undefined"
                :aria-describedby="travelerEmailDescribedBy"
                @blur="hasTravelerEmailBlurred = true"
              />
              <p
                :id="TRAVELER_EMAIL_HELP_ID"
                class="field-help"
              >
                Votre confirmation de réservation et le lien du guide d'arrivée y seront envoyés.
              </p>
              <p
                :id="TRAVELER_EMAIL_ERROR_ID"
                class="field-error"
                aria-live="polite"
              >
                {{ travelerEmailError ?? '' }}
              </p>
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
          :disabled="!canAccessReminderStep"
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
          <ScrollText
            v-if="hasHouseRules"
            :size="16"
            class="section-title-icon"
            aria-hidden="true"
          />
          <MessageCircle
            v-else
            :size="16"
            class="section-title-icon"
            aria-hidden="true"
          />
          <span class="section-title-label">{{ hasHouseRules ? 'Règlement intérieur' : 'Un petit rappel' }}</span>
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
          <template v-if="hasHouseRules">
            <p class="section-text">
              Votre hôte a fixé un règlement intérieur pour son logement.
              <strong>Lisez-le avant de payer :</strong> en réservant, vous vous engagez à le respecter.
            </p>
            <div
              class="house-rules"
              :class="{ 'is-expanded': showHouseRulesContent }"
            >
              <p class="house-rules-title">Règlement intérieur de l'hôte</p>
              <p
                v-if="!showHouseRulesContent"
                class="house-rules-excerpt"
              >
                {{ houseRulesExcerpt }}
              </p>
              <div
                :id="houseRulesContentId"
                class="house-rules-content"
                :aria-hidden="!showHouseRulesContent"
              >
                <div class="house-rules-content-inner">
                  <div
                    class="house-rules-html"
                    v-html="houseRulesHtml"
                  />
                </div>
              </div>
              <button
                v-if="!isHouseRulesShort"
                type="button"
                class="house-rules-toggle"
                :aria-expanded="isHouseRulesExpanded"
                :aria-controls="houseRulesContentId"
                @click="toggleHouseRules"
              >
                <span>{{ isHouseRulesExpanded ? 'Masquer le règlement' : 'Voir le règlement' }}</span>
                <ChevronDown
                  :size="16"
                  class="house-rules-chevron"
                  :class="{ 'is-open': isHouseRulesExpanded }"
                  aria-hidden="true"
                />
              </button>
            </div>
            <label class="progress-check-field">
              <input
                v-model="hasAcknowledgedReminder"
                :disabled="!canAccessReminderStep"
                type="checkbox"
              />
              <span>J'ai lu le règlement intérieur de l'hôte et je m'engage à le respecter.</span>
            </label>
          </template>
          <template v-else>
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
          </template>
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
          :disabled="!canAccessFinalStep"
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
          <p
            v-if="hostLegalStatusLine"
            class="section-text host-legal-status"
          >
            {{ hostLegalStatusLine }}
          </p>
          <div class="cancellation-summary">
            <p class="cancellation-summary-title">
              Conditions d'annulation de l'hôte ({{ cancellationPolicyLabel }})
            </p>
            <ul>
              <li
                v-for="rule in cancellationRuleLines"
                :key="rule"
              >
                {{ rule }}
              </li>
            </ul>
          </div>
          <p class="section-text">
            Vous concluez le contrat de location directement avec l'hôte, qui reste responsable du logement et du séjour. IndieHost fournit la page de réservation et le paiement en ligne. Une réservation pour des dates déterminées n'ouvre pas droit à rétractation.
          </p>
          <p class="section-text">
            En cliquant sur le bouton ci-dessous, j'accepte les conditions d'annulation de l'hôte<template v-if="hasHouseRules">, son règlement intérieur</template> et les
            <a
              class="link"
              href="/legal/cgu-voyageurs"
              target="_blank"
              rel="noopener"
            >conditions d'utilisation et de réservation</a>,
            et je reconnais avoir pris connaissance de la
            <a
              class="link"
              href="/legal/confidentialite"
              target="_blank"
              rel="noopener"
            >politique de confidentialité</a>.
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
