<!-- File: src/views/BookingGroup/components/GroupSharePayment.vue -->

<script setup lang="ts">
// Règlement d'une part d'un paiement à plusieurs : nom du titulaire, module de paiement Stripe
// (carte autorisée, pas débitée), puis annonce du règlement à l'API. Le paiement vit sur le compte
// Stripe de l'hôte, comme une réservation ordinaire (`Checkout.vue`).
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Lock } from '@lucide/vue'
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js'

import type { GroupPaymentPage, GroupPaymentSource, GroupShareIntent } from '@/domain/api/groupPayments'
import { getStripePublishableKey, loadStripeClient } from '@/domain/payments/stripeClient'

const props = defineProps<{
  shareKey: string
  source: GroupPaymentSource
  amountLabel: string
  payers: number
}>()

const emit = defineEmits<{
  (e: 'paid', page: GroupPaymentPage): void
}>()

const firstName = ref('')
const lastName = ref('')
const isPreparing = ref(true)
const isSubmitting = ref(false)
const isElementComplete = ref(false)
const isMock = ref(false)
const error = ref<string | null>(null)
const mountNode = ref<HTMLDivElement | null>(null)

let stripe: Stripe | null = null
let elements: StripeElements | null = null
let paymentElement: StripePaymentElement | null = null
let intent: GroupShareIntent | null = null

function fullName(): string {
  return `${firstName.value.trim()} ${lastName.value.trim()}`.trim()
}

function readMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message.trim() ? reason.message.trim() : fallback
}

async function prepare() {
  isPreparing.value = true
  error.value = null

  try {
    intent = await props.source.createShareIntent(props.shareKey, { name: fullName() })
    if (intent.mock) {
      isMock.value = true
      return
    }

    if (!getStripePublishableKey()) {
      throw new Error('Le paiement en ligne n’est pas disponible pour le moment.')
    }
    stripe = await loadStripeClient(intent.connectedAccountId)
    if (!stripe) throw new Error('Le module de paiement ne peut pas être chargé pour le moment.')

    isPreparing.value = false
    await nextTick()
    if (!mountNode.value) throw new Error('Le module de paiement ne peut pas être affiché pour le moment.')

    elements = stripe.elements({ clientSecret: intent.clientSecret, appearance: { theme: 'stripe' } })
    paymentElement = elements.create('payment', {
      layout: 'tabs',
      fields: { billingDetails: { name: 'never' } },
    })
    paymentElement.on('change', (event) => {
      isElementComplete.value = Boolean(event.complete)
      if (error.value) error.value = null
    })
    paymentElement.mount(mountNode.value)
  } catch (reason) {
    console.error('[GroupSharePayment] prepare failed', reason)
    error.value = readMessage(reason, 'Impossible de préparer le paiement de votre part.')
  } finally {
    isPreparing.value = false
  }
}

async function submit() {
  if (isSubmitting.value || isPreparing.value) return
  if (!firstName.value.trim() || !lastName.value.trim()) {
    error.value = 'Saisissez le prénom et le nom du titulaire de la carte.'
    return
  }

  isSubmitting.value = true
  error.value = null

  try {
    if (!isMock.value) {
      if (!stripe || !elements || !intent) {
        error.value = 'Le paiement n’est pas prêt. Réessayez dans quelques secondes.'
        return
      }

      const submitted = await elements.submit()
      if (submitted.error) {
        error.value = submitted.error.message ?? 'Les informations de paiement sont incomplètes.'
        return
      }

      // Le nom saisi est gardé avec la part : l'organisateur voit qui a réglé.
      await props.source.createShareIntent(props.shareKey, { name: fullName() })

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Retour d'une validation bancaire qui quitte la page : elle se recharge et constate le règlement.
          return_url: window.location.href,
          payment_method_data: { billing_details: { name: fullName() } },
        },
        redirect: 'if_required',
      })
      if (result.error) {
        error.value = result.error.message ?? 'Le paiement a été refusé.'
        return
      }
    } else {
      await props.source.createShareIntent(props.shareKey, { name: fullName() })
    }

    emit('paid', await props.source.confirmShare(props.shareKey))
  } catch (reason) {
    console.error('[GroupSharePayment] payment failed', reason)
    error.value = readMessage(reason, 'Impossible de régler votre part pour le moment.')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  void prepare()
})

onBeforeUnmount(() => {
  if (paymentElement) {
    paymentElement.unmount()
    paymentElement.destroy()
    paymentElement = null
  }
  elements = null
})
</script>

<template>
  <form
    class="group-share-payment"
    novalidate
    @submit.prevent="submit"
  >
    <div class="names">
      <label class="field">
        <span>Prénom du titulaire</span>
        <input
          v-model="firstName"
          type="text"
          autocomplete="cc-given-name"
          placeholder="Prénom"
        />
      </label>
      <label class="field">
        <span>Nom du titulaire</span>
        <input
          v-model="lastName"
          type="text"
          autocomplete="cc-family-name"
          placeholder="Nom"
        />
      </label>
    </div>

    <p
      v-if="isPreparing"
      class="placeholder"
    >
      Préparation du paiement sécurisé…
    </p>
    <p
      v-else-if="isMock"
      class="placeholder"
    >
      Paiement simulé : aucune clé Stripe n’est configurée sur ce serveur de développement.
    </p>
    <div
      v-show="!isPreparing && !isMock"
      class="element-shell"
    >
      <div ref="mountNode" />
    </div>

    <p
      class="error"
      role="alert"
    >
      {{ error ?? '' }}
    </p>

    <div class="btn-primary__full">
      <button
        type="submit"
        :disabled="isPreparing || isSubmitting || (!isMock && !isElementComplete)"
      >
        {{ isSubmitting ? 'Paiement en cours…' : `Régler ma part (${props.amountLabel})` }}
      </button>
    </div>
    <p class="reassurance">
      <Lock
        :size="14"
        aria-hidden="true"
      />
      <span>Votre carte est autorisée, pas débitée : le débit n’a lieu que lorsque les {{ props.payers }} parts sont réglées.</span>
    </p>
  </form>
</template>
