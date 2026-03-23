<!-- File: src/views/Domains/DomainPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { createGrandiDomainCheckoutSession, fetchGrandiDomainAvailability } from '@/domain/api/grandiDomains'
import { readActiveUserId } from '@/router/backOfficeUser'

const route = useRoute()

const domainInput = ref('')
const isCheckingAvailability = ref(false)
const isCreatingCheckout = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const checkoutStatus = ref<string | null>(null)
const availability = ref<{
  domain: string
  available: boolean
  premium: boolean
  priceCents: number | null
  currency: string
  reason: string | null
} | null>(null)

const userId = computed(() => readActiveUserId(route.params.userId))

const normalizedDomain = computed(() => domainInput.value.trim().toLowerCase())
const canCheck = computed(() => normalizedDomain.value.length >= 4 && normalizedDomain.value.includes('.'))
const canCheckout = computed(() => Boolean(availability.value?.available && availability.value?.domain))

function formatPrice(priceCents: number | null, currency = 'EUR') {
  if (priceCents === null) return 'Prix communiqué au checkout'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(priceCents / 100)
}

function resetFeedback() {
  errorMessage.value = null
  successMessage.value = null
  checkoutStatus.value = null
}

async function checkAvailability() {
  if (!canCheck.value || isCheckingAvailability.value) return

  resetFeedback()
  availability.value = null
  isCheckingAvailability.value = true

  try {
    const result = await fetchGrandiDomainAvailability(normalizedDomain.value)
    availability.value = result

    if (!result.domain) {
      errorMessage.value = 'Réponse API invalide: domaine absent.'
      return
    }

    if (result.available) {
      successMessage.value = `Le domaine ${result.domain} est disponible.`
      return
    }

    errorMessage.value = result.reason || `Le domaine ${result.domain} n'est pas disponible.`
  } catch (error) {
    console.error('[DomainPanel] availability check failed', error)
    errorMessage.value = 'Impossible de vérifier la disponibilité pour le moment.'
  } finally {
    isCheckingAvailability.value = false
  }
}

async function startCheckout() {
  const candidate = availability.value
  if (!candidate?.available || isCreatingCheckout.value) return

  const activeUserId = userId.value
  if (!activeUserId) {
    errorMessage.value = "Impossible de demarrer le paiement: userId manquant."
    return
  }

  resetFeedback()
  isCreatingCheckout.value = true

  try {
    const successUrl = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/domains/${activeUserId}?checkout=success` : undefined
    const cancelUrl = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/domains/${activeUserId}?checkout=cancel` : undefined
    const session = await createGrandiDomainCheckoutSession({
      domain: candidate.domain,
      userId: activeUserId,
      successUrl,
      cancelUrl,
    })

    checkoutStatus.value = 'Redirection vers le paiement sécurisé...'
    window.location.assign(session.checkoutUrl)
  } catch (error) {
    console.error('[DomainPanel] checkout creation failed', error)
    errorMessage.value = 'Impossible de démarrer le paiement du domaine.'
  } finally {
    isCreatingCheckout.value = false
  }
}
</script>

<template>
  <section class="domain-panel">
    <div class="domain-panel__header">
      <h1>DomainPanel</h1>
      <p>Vérifiez la disponibilité d'un nom de domaine puis lancez le paiement via Grandi.net.</p>
    </div>

    <div class="domain-panel__form">
      <label for="domain-input">Nom de domaine</label>
      <input
        id="domain-input"
        v-model="domainInput"
        type="text"
        placeholder="ex: mon-super-site.fr"
        autocomplete="off"
      />

      <button
        type="button"
        :disabled="!canCheck || isCheckingAvailability"
        @click="checkAvailability"
      >
        {{ isCheckingAvailability ? 'Vérification...' : 'Vérifier la disponibilité' }}
      </button>
    </div>

    <p
      v-if="successMessage"
      class="domain-panel__feedback is-success"
    >
      {{ successMessage }}
    </p>
    <p
      v-if="errorMessage"
      class="domain-panel__feedback is-error"
    >
      {{ errorMessage }}
    </p>

    <div
      v-if="availability"
      class="domain-panel__result"
    >
      <p><strong>Domaine:</strong> {{ availability.domain }}</p>
      <p><strong>Disponibilité:</strong> {{ availability.available ? 'Disponible' : 'Indisponible' }}</p>
      <p><strong>Type:</strong> {{ availability.premium ? 'Premium' : 'Standard' }}</p>
      <p><strong>Prix:</strong> {{ formatPrice(availability.priceCents, availability.currency) }}</p>

      <button
        type="button"
        class="domain-panel__checkout"
        :disabled="!canCheckout || isCreatingCheckout"
        @click="startCheckout"
      >
        {{ isCreatingCheckout ? 'Création du paiement...' : 'Payer ce nom de domaine' }}
      </button>

      <p
        v-if="checkoutStatus"
        class="domain-panel__feedback"
      >
        {{ checkoutStatus }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Domains/domain-panel.scss';
</style>
