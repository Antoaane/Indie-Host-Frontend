<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/CustomDomainPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  fetchListingDomain,
  removeListingCustomDomain,
  saveListingCustomDomain,
  verifyListingCustomDomain,
  type ListingDomainRecord,
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

type DnsRecord = {
  type: 'A' | 'CNAME'
  name: string
  value: string
}

const domainInput = ref('')
const currentDomain = ref<ListingDomainRecord | null>(null)
const isLoadingCurrent = ref(false)
const isLoadingSubscription = ref(false)
const isSaving = ref(false)
const isVerifying = ref(false)
const isDeleting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const hasSelectedPlan = ref(false)

const rootDomain = getPublicListingRootDomain()
const normalizedDomain = computed(() => normalizeDomainInput(domainInput.value))
const canManageDomain = computed(() => Boolean(props.isAdmin || (hasSelectedPlan.value && !isLoadingSubscription.value)))
const attachedDomain = computed(() => currentDomain.value?.customDomain ?? null)
const status = computed(() => currentDomain.value?.customDomainStatus ?? 'none')
const isVerified = computed(() => status.value === 'verified')
const targets = computed(() => currentDomain.value?.customDomainTargets ?? { ipv4: null, cname: null })
const isDirty = computed(() => Boolean(normalizedDomain.value) && normalizedDomain.value !== attachedDomain.value)
const canSave = computed(() => canManageDomain.value && isValidDomain(normalizedDomain.value) && isDirty.value)

const statusLabel = computed(() => {
  if (status.value === 'verified') return 'Actif'
  if (status.value === 'pending') return 'En attente de la configuration DNS'
  return 'Aucun domaine rattaché'
})

// Enregistrement à créer chez le registrar : CNAME pour un sous-domaine (www…), A pour un domaine nu.
const dnsRecords = computed<DnsRecord[]>(() => {
  const domain = attachedDomain.value ?? (isValidDomain(normalizedDomain.value) ? normalizedDomain.value : '')
  if (!domain) return []

  const labels = domain.split('.')
  const name = labels.length > 2 ? labels.slice(0, -2).join('.') : '@'

  if (name !== '@' && targets.value.cname) {
    return [{ type: 'CNAME', name, value: targets.value.cname }]
  }
  if (targets.value.ipv4) {
    return [{ type: 'A', name, value: targets.value.ipv4 }]
  }
  return []
})

function normalizeDomainInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    ?.split(':')[0]
    ?.replace(/\.$/, '') ?? ''
}

function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
}

function resetFeedback() {
  errorMessage.value = null
  successMessage.value = null
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

function applyRecord(domain: ListingDomainRecord) {
  currentDomain.value = domain
  domainInput.value = domain.customDomain ?? ''
  emit('updated', domain)
}

async function loadCurrentDomain() {
  if (!props.listingId.trim()) return

  resetFeedback()
  currentDomain.value = null
  domainInput.value = ''
  isLoadingCurrent.value = true

  try {
    const domain = await fetchListingDomain(props.listingId)
    currentDomain.value = domain
    domainInput.value = domain.customDomain ?? ''
  } catch (error) {
    console.error('[EditorCustomDomainPanel] failed to load current domain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de charger le domaine actuel.')
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
    console.error('[EditorCustomDomainPanel] failed to load subscription state', error)
    hasSelectedPlan.value = false
  } finally {
    isLoadingSubscription.value = false
  }
}

async function saveDomain() {
  if (isSaving.value) return

  resetFeedback()

  if (!canManageDomain.value) {
    errorMessage.value = 'Sélectionnez un plan d abonnement pour rattacher un nom de domaine.'
    return
  }

  if (!isValidDomain(normalizedDomain.value)) {
    errorMessage.value = 'Saisissez un nom de domaine valide, par exemple www.gite-belair.fr.'
    return
  }

  if (!isDirty.value) return

  isSaving.value = true
  try {
    const domain = await saveListingCustomDomain(props.listingId, normalizedDomain.value)
    applyRecord(domain)
    successMessage.value = domain.customDomainStatus === 'verified'
      ? `${domain.customDomain} est rattaché et déjà actif.`
      : `${domain.customDomain} est rattaché. Créez l’enregistrement DNS ci-dessous puis vérifiez la configuration.`
  } catch (error) {
    console.error('[EditorCustomDomainPanel] failed to save custom domain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de rattacher ce nom de domaine.')
  } finally {
    isSaving.value = false
  }
}

async function verifyDomain() {
  if (isVerifying.value || !attachedDomain.value) return

  resetFeedback()
  isVerifying.value = true
  try {
    const { record, verification } = await verifyListingCustomDomain(props.listingId)
    applyRecord(record)
    if (verification.ok) {
      successMessage.value = `Configuration DNS validée : ${record.customDomain} est actif. Le certificat HTTPS est généré dans les minutes qui suivent.`
      return
    }
    errorMessage.value = verification.reason ?? 'La configuration DNS n’est pas encore en place.'
  } catch (error) {
    console.error('[EditorCustomDomainPanel] failed to verify custom domain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de vérifier la configuration DNS.')
  } finally {
    isVerifying.value = false
  }
}

async function deleteDomain() {
  if (isDeleting.value || !attachedDomain.value) return

  resetFeedback()
  isDeleting.value = true
  try {
    const domain = await removeListingCustomDomain(props.listingId)
    applyRecord(domain)
    successMessage.value = 'Le nom de domaine a été détaché de cette annonce.'
  } catch (error) {
    console.error('[EditorCustomDomainPanel] failed to remove custom domain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de détacher ce nom de domaine.')
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

watch(domainInput, () => {
  errorMessage.value = null
  successMessage.value = null
})

onMounted(() => {
  void loadSubscriptionState()
  void loadCurrentDomain()
})
</script>

<template>
  <section class="editor-custom-domain-panel">
    <div class="header">
      <h3>Votre propre nom de domaine</h3>
      <p>Rattachez un domaine que vous possédez déjà (ex. www.gite-belair.fr) : votre annonce y sera servie en HTTPS, en plus de son adresse {{ rootDomain }}.</p>
    </div>

    <div class="body">
      <div class="input">
        <input
          v-model="domainInput"
          type="text"
          placeholder="ex: www.gite-belair.fr"
          autocomplete="off"
          spellcheck="false"
          :disabled="isLoadingCurrent || (!props.isAdmin && isLoadingSubscription) || !canManageDomain"
          @keydown.enter.prevent="saveDomain"
        />
      </div>

      <div class="actions">
        <div class="manage">
          <button
            type="button"
            :disabled="!canSave || isSaving"
            @click="saveDomain"
          >
            {{ isSaving ? 'Rattachement...' : (attachedDomain ? 'Changer de domaine' : 'Rattacher ce domaine') }}
          </button>
        </div>

        <div
          v-if="attachedDomain"
          class="checkout"
        >
          <button
            type="button"
            :disabled="isVerifying || isVerified"
            @click="verifyDomain"
          >
            {{ isVerifying ? 'Vérification...' : (isVerified ? 'DNS vérifié' : 'Vérifier la configuration DNS') }}
          </button>
        </div>

        <div
          v-if="attachedDomain"
          class="checkout"
        >
          <button
            type="button"
            :disabled="isDeleting"
            @click="deleteDomain"
          >
            {{ isDeleting ? 'Suppression...' : 'Détacher le domaine' }}
          </button>
        </div>
      </div>

      <div
        v-if="attachedDomain"
        class="availability"
      >
        <p><strong>Domaine :</strong> {{ attachedDomain }}</p>
        <p>
          <strong>Statut :</strong>
          <span :class="['status', `is-${status}`]">{{ statusLabel }}</span>
        </p>
        <p v-if="isVerified && currentDomain?.customDomainUrl">
          <strong>URL :</strong>
          <a
            :href="currentDomain.customDomainUrl"
            target="_blank"
            rel="noreferrer"
          >
            {{ currentDomain.customDomainUrl }}
          </a>
        </p>
      </div>

      <div
        v-if="dnsRecords.length"
        class="dns"
      >
        <p class="dns-title">Enregistrement à créer dans la zone DNS de votre registrar (OVH, Gandi, IONOS, GoDaddy…)</p>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Nom</th>
              <th>Valeur</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="record in dnsRecords"
              :key="`${record.type}-${record.name}`"
            >
              <td>{{ record.type }}</td>
              <td><code>{{ record.name }}</code></td>
              <td><code>{{ record.value }}</code></td>
            </tr>
          </tbody>
        </table>
        <p class="dns-hint">
          La propagation DNS prend de quelques minutes à 24 h. Une fois vérifié, le certificat HTTPS est généré automatiquement.
        </p>
      </div>

      <p
        v-if="!isLoadingSubscription && !props.isAdmin && !hasSelectedPlan"
        class="meta is-error"
      >
        Sélectionnez d abord un plan d abonnement pour rattacher un nom de domaine.
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
        Chargement du domaine actuel...
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

.editor-custom-domain-panel {
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

      > .manage,
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
        word-break: break-word;

        > .status {
          &.is-verified {
            color: rgba($good, 0.95);
          }

          &.is-pending {
            color: rgba($secondary, 0.7);
          }
        }
      }
    }

    > .dns {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      > .dns-title,
      > .dns-hint {
        margin: 0;
        @include little-text($thin: false);
        color: rgba($secondary, 0.72);
      }

      > table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid rgba($secondary, 0.1);
        border-radius: borders.$rounded-sm;
        overflow: hidden;

        th,
        td {
          padding: calc(var(--layout-gap-xs) / 2) var(--layout-gap-xs);
          text-align: left;
          @include little-text($thin: false);
          color: rgba($secondary, 0.82);
          border-bottom: 1px solid rgba($secondary, 0.08);
          word-break: break-all;
        }

        th {
          background: rgba($secondary, 0.04);
        }

        tr:last-child > td {
          border-bottom: 0;
        }

        code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          user-select: all;
        }
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
