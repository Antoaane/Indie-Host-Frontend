<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/DomainPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import { createGrandiDomainCheckoutSession, fetchGrandiDomainAvailability } from '@/domain/api/grandiDomains'

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

const normalizedDomain = computed(() => domainInput.value.trim().toLowerCase())
const canCheckout = computed(() => Boolean(availability.value?.available && availability.value?.domain))

function formatPrice(priceCents: number | null, currency = 'EUR') {
  if (priceCents === null) return 'Prix communiqué au paiement'
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
  if (isCheckingAvailability.value) return

  resetFeedback()

  if (!normalizedDomain.value || !normalizedDomain.value.includes('.') || normalizedDomain.value.length < 4) {
    errorMessage.value = 'Saisissez un nom de domaine valide (ex: mon-site.fr).'
    return
  }
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
    console.error('[EditorDomainPanel] availability check failed', error)
    errorMessage.value = 'Impossible de vérifier la disponibilité pour le moment.'
  } finally {
    isCheckingAvailability.value = false
  }
}

async function startCheckout() {
  const candidate = availability.value
  if (!candidate?.available || isCreatingCheckout.value) return

  resetFeedback()
  isCreatingCheckout.value = true

  try {
    const successUrl = typeof window !== 'undefined' ? `${window.location.origin}/editor?domainCheckout=success` : undefined
    const cancelUrl = typeof window !== 'undefined' ? `${window.location.origin}/editor?domainCheckout=cancel` : undefined
    const session = await createGrandiDomainCheckoutSession({
      domain: candidate.domain,
      successUrl,
      cancelUrl,
    })

    checkoutStatus.value = 'Redirection vers le paiement sécurisé...'
    if (typeof window !== 'undefined') {
      window.location.assign(session.checkoutUrl)
    }
  } catch (error) {
    console.error('[EditorDomainPanel] checkout creation failed', error)
    errorMessage.value = 'Impossible de démarrer le paiement du domaine.'
  } finally {
    isCreatingCheckout.value = false
  }
}
</script>

<template>
  <section class="editor-domain-panel">
    <div class="header">
      <h3>Nom de domaine</h3>
      <p>Vérifiez et faites payer un domaine via l'API Grandi.net.</p>
    </div>

    <div class="body">
      <div class="input">
        <input
          v-model="domainInput"
          type="text"
          placeholder="ex: mon-logement.fr"
          autocomplete="off"
          @keydown.enter.prevent="checkAvailability"
        />
      </div>

      <div class="actions">
        <div class="manage">
          <button
            type="button"
            :disabled="isCheckingAvailability"
            @click="checkAvailability"
          >
            {{ isCheckingAvailability ? 'Vérification...' : 'Vérifier la disponibilité' }}
          </button>
        </div>

        <div class="checkout">
          <button
            type="button"
            :disabled="!canCheckout || isCreatingCheckout"
            @click="startCheckout"
          >
            {{ isCreatingCheckout ? 'Redirection...' : 'Payer le domaine' }}
          </button>
        </div>
      </div>

      <div
        v-if="availability"
        class="availability"
      >
        <p><strong>Domaine:</strong> {{ availability.domain }}</p>
        <p><strong>Statut:</strong> {{ availability.available ? 'Disponible' : 'Indisponible' }}</p>
        <p><strong>Prix:</strong> {{ formatPrice(availability.priceCents, availability.currency) }}</p>
      </div>

      <p
        v-if="successMessage"
        class="meta is-success"
      >
        {{ successMessage }}
      </p>
      <p
        v-if="checkoutStatus"
        class="meta"
      >
        {{ checkoutStatus }}
      </p>
      <p
        v-if="errorMessage"
        class="meta is-error"
      >
        {{ errorMessage }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-domain-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .input {
      @include inputs.field($theme: base);
    }

    > .actions {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      > .manage {
        @include buttons.primary($theme: white, $fullwidth: true);
      }

      > .checkout {
        @include buttons.primary($theme: white, $fullwidth: true);
      }
    }

    > .availability {
      display: flex;
      flex-direction: column;
      gap: calc(var(--layout-gap-xs) / 2);
      padding: var(--layout-gap-sm);
      border-radius: borders.$rounded-sm;
      border: 1px solid rgba($secondary, 0.1);
      background: rgba($secondary, 0.02);

      > p {
        margin: 0;
        @include little-text($thin: false);
        color: rgba($secondary, 0.82);
      }
    }

    > .meta {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.7);

      &.is-success {
        color: rgba($good, 0.95);
      }

      &.is-error {
        color: rgba($bad, 0.95);
      }
    }
  }
}
</style>
