<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/DomainPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  fetchListingDomain,
  fetchListingSubdomainAvailability,
  removeListingDomain,
  saveListingDomain,
  type ListingDomainRecord,
  type ListingSubdomainAvailability,
} from '@/domain/api/listingDomains'
import { fetchMyStripeSubscriptionState } from '@/domain/api/stripeSubscriptions'
import { getPublicListingRootDomain } from '@/domain/listings/publicDomain'

const props = defineProps<{
  listingId: string
  isAdmin?: boolean
}>()

const emit = defineEmits<{
  (e: 'updated', domain: ListingDomainRecord): void
}>()

const subdomainInput = ref('')
const currentDomain = ref<ListingDomainRecord | null>(null)
const availability = ref<ListingSubdomainAvailability | null>(null)
const isLoadingCurrent = ref(false)
const isLoadingSubscription = ref(false)
const isCheckingAvailability = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const hasSelectedPlan = ref(false)

const normalizedSlug = computed(() => subdomainInput.value.trim().toLowerCase())
const rootDomain = getPublicListingRootDomain()
const previewHostname = computed(() => normalizedSlug.value ? `${normalizedSlug.value}.${rootDomain}` : '')
const previewUrl = computed(() => previewHostname.value ? `https://${previewHostname.value}` : '')
const canManageSubdomain = computed(() => Boolean(props.isAdmin || (hasSelectedPlan.value && !isLoadingSubscription.value)))
const canSave = computed(() => Boolean(
  canManageSubdomain.value
  && availability.value?.available
  && availability.value.slug === normalizedSlug.value
  && normalizedSlug.value,
))

function resetFeedback() {
  errorMessage.value = null
  successMessage.value = null
}

function resetState() {
  subdomainInput.value = ''
  currentDomain.value = null
  availability.value = null
  resetFeedback()
}

function isValidSlug(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(slug)
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

async function loadCurrentDomain() {
  if (!props.listingId.trim()) return

  resetState()
  isLoadingCurrent.value = true

  try {
    const domain = await fetchListingDomain(props.listingId)
    currentDomain.value = domain
    subdomainInput.value = domain.subdomainSlug ?? ''
  } catch (error) {
    console.error('[EditorDomainPanel] failed to load current domain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de charger le sous-domaine actuel.')
  } finally {
    isLoadingCurrent.value = false
  }
}

function computeHasSelectedPlanFromBillingState(state: Awaited<ReturnType<typeof fetchMyStripeSubscriptionState>>) {
  const activePlan = state.subscription?.planCode ?? null
  const pendingPlan = state.subscription?.pendingPlanCode ?? null
  const currentPlan = state.currentPlanCode ?? null
  return Boolean(activePlan || pendingPlan || currentPlan)
}

async function loadSubscriptionState() {
  isLoadingSubscription.value = true
  try {
    const billingState = await fetchMyStripeSubscriptionState({ sync: false })
    hasSelectedPlan.value = computeHasSelectedPlanFromBillingState(billingState)
  } catch (error) {
    console.error('[EditorDomainPanel] failed to load subscription state', error)
    hasSelectedPlan.value = false
  } finally {
    isLoadingSubscription.value = false
  }
}

async function checkAvailability() {
  if (isCheckingAvailability.value) return

  resetFeedback()
  availability.value = null

  if (!canManageSubdomain.value) {
    errorMessage.value = 'Sélectionnez un plan d abonnement pour réserver un sous-domaine.'
    return
  }

  if (!normalizedSlug.value || !isValidSlug(normalizedSlug.value)) {
    errorMessage.value = 'Utilisez un slug valide: lettres, chiffres et tirets uniquement.'
    return
  }

  isCheckingAvailability.value = true
  try {
    const result = await fetchListingSubdomainAvailability(normalizedSlug.value, props.listingId)
    availability.value = result

    if (result.available) {
      successMessage.value = `Le sous-domaine ${result.hostname} est disponible.`
      return
    }

    errorMessage.value = result.reason || 'Ce sous-domaine n’est pas disponible.'
  } catch (error) {
    console.error('[EditorDomainPanel] availability check failed', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de vérifier la disponibilité du sous-domaine.')
  } finally {
    isCheckingAvailability.value = false
  }
}

async function saveDomain() {
  if (!canSave.value || isSaving.value) return

  resetFeedback()
  isSaving.value = true

  try {
    const domain = await saveListingDomain(props.listingId, normalizedSlug.value)
    currentDomain.value = domain
    availability.value = null
    subdomainInput.value = domain.subdomainSlug ?? ''
    emit('updated', domain)
    successMessage.value = domain.subdomainSlug
      ? `Le sous-domaine ${domain.subdomainSlug}.${rootDomain} est réservé pour cette annonce.`
      : 'Sous-domaine mis à jour.'
  } catch (error) {
    console.error('[EditorDomainPanel] failed to save subdomain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible d’enregistrer ce sous-domaine.')
  } finally {
    isSaving.value = false
  }
}

async function deleteDomain() {
  if (isDeleting.value || !currentDomain.value?.subdomainSlug) return

  resetFeedback()
  isDeleting.value = true

  try {
    const domain = await removeListingDomain(props.listingId)
    currentDomain.value = domain
    availability.value = null
    subdomainInput.value = ''
    emit('updated', domain)
    successMessage.value = 'Le sous-domaine a été libéré.'
  } catch (error) {
    console.error('[EditorDomainPanel] failed to delete subdomain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de libérer ce sous-domaine.')
  } finally {
    isDeleting.value = false
  }
}

watch(
  () => props.listingId,
  () => {
    void loadSubscriptionState()
    void loadCurrentDomain()
  },
)

watch(subdomainInput, (value) => {
  // Normalise automatiquement les espaces et majuscules en slug compatible
  // Ex. "gite de saint francois" → "gite-de-saint-francois"
  const sanitized = value.replace(/\s+/g, '-')
  if (sanitized !== value) {
    subdomainInput.value = sanitized
    return
  }

  availability.value = null
  errorMessage.value = null
  successMessage.value = null
})

watch(hasSelectedPlan, (allowed) => {
  if (allowed) return
  availability.value = null
})

onMounted(() => {
  void loadSubscriptionState()
  void loadCurrentDomain()
})
</script>

<template>
  <section class="editor-domain-panel">
    <div class="header">
      <h3>Adresse IndieHost (sous-domaine)</h3>
      <p>Votre annonce a deux adresses possibles. Celle-ci est <strong>gratuite et immédiate</strong> : choisissez un nom, elle est en ligne sur {{ rootDomain }} sans aucun réglage. Le panneau suivant permet en plus d’utiliser <strong>votre propre nom de domaine</strong> ; les deux adresses mènent à cette annonce.</p>
    </div>

    <div class="body">
      <div class="input">
        <input
          v-model="subdomainInput"
          type="text"
          placeholder="ex: mon-logement"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          enterkeyhint="search"
          :disabled="isLoadingCurrent || (!props.isAdmin && isLoadingSubscription) || !canManageSubdomain"
          @keydown.enter.prevent="checkAvailability"
        />
      </div>

      <p class="hint">
        <template v-if="previewUrl">URL publique : <strong>{{ previewUrl }}</strong></template>
        <template v-else>Exemple d’URL publique : <strong>https://mon-logement.{{ rootDomain }}</strong></template>
      </p>

      <div class="actions">
        <div class="manage">
          <button
            type="button"
            :disabled="isCheckingAvailability || isLoadingCurrent || !canManageSubdomain"
            @click="checkAvailability"
          >
            {{ isCheckingAvailability ? 'Vérification...' : 'Vérifier la disponibilité' }}
          </button>
        </div>

        <div class="checkout">
          <button
            type="button"
            :disabled="!canSave || isSaving"
            @click="saveDomain"
          >
            {{ isSaving ? 'Enregistrement...' : 'Réserver ce sous-domaine' }}
          </button>
        </div>

        <div class="checkout">
          <button
            type="button"
            :disabled="!currentDomain?.subdomainSlug || isDeleting"
            @click="deleteDomain"
          >
            {{ isDeleting ? 'Suppression...' : 'Libérer le sous-domaine' }}
          </button>
        </div>
      </div>

      <div
        v-if="currentDomain?.subdomainSlug"
        class="availability"
      >
        <p><strong>Actuel :</strong> {{ currentDomain.subdomainSlug }}</p>
        <p><strong>Hostname :</strong> {{ currentDomain.hostname }}</p>
        <p>
          <strong>URL :</strong>
          <a
            v-if="currentDomain.publicUrl"
            :href="currentDomain.publicUrl"
            target="_blank"
            rel="noreferrer"
          >
            {{ currentDomain.publicUrl }}
          </a>
        </p>
      </div>

      <div
        v-if="availability"
        class="availability"
      >
        <p><strong>Slug :</strong> {{ availability.slug }}</p>
        <p><strong>Statut :</strong> {{ availability.available ? 'Disponible' : 'Indisponible' }}</p>
        <p><strong>Hostname :</strong> {{ availability.hostname }}</p>
      </div>

      <p
        v-if="!isLoadingSubscription && !props.isAdmin && !hasSelectedPlan"
        class="meta is-error"
      >
        Sélectionnez d abord un plan d abonnement pour réserver un sous-domaine.
      </p>
      <p
        v-if="isLoadingSubscription"
        class="meta"
      >
        Vérification du plan en cours...
      </p>
      <p
        v-if="successMessage"
        class="meta is-success"
      >
        {{ successMessage }}
      </p>
      <p
        v-if="isLoadingCurrent"
        class="meta"
      >
        Chargement du sous-domaine actuel...
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

    > .hint {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.72);
      word-break: break-word;
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
        color: $bad-ink;
      }
    }
  }
}
</style>
