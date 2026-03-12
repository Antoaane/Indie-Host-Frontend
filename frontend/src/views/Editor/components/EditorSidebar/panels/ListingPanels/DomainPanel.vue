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
import { getPublicListingRootDomain } from '@/domain/listings/publicDomain'

const props = defineProps<{
  listingId: string
}>()

const subdomainInput = ref('')
const currentDomain = ref<ListingDomainRecord | null>(null)
const availability = ref<ListingSubdomainAvailability | null>(null)
const isLoadingCurrent = ref(false)
const isCheckingAvailability = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const normalizedSlug = computed(() => subdomainInput.value.trim().toLowerCase())
const rootDomain = getPublicListingRootDomain()
const previewHostname = computed(() => normalizedSlug.value ? `${normalizedSlug.value}.${rootDomain}` : '')
const previewUrl = computed(() => previewHostname.value ? `https://${previewHostname.value}` : '')
const canSave = computed(() => Boolean(availability.value?.available && normalizedSlug.value))

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
    errorMessage.value = 'Impossible de charger le sous-domaine actuel.'
  } finally {
    isLoadingCurrent.value = false
  }
}

async function checkAvailability() {
  if (isCheckingAvailability.value) return

  resetFeedback()
  availability.value = null

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
    errorMessage.value = 'Impossible de vérifier la disponibilité du sous-domaine.'
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
    successMessage.value = domain.subdomainSlug
      ? `Le sous-domaine ${domain.subdomainSlug}.${rootDomain} est réservé pour cette annonce.`
      : 'Sous-domaine mis à jour.'
  } catch (error) {
    console.error('[EditorDomainPanel] failed to save subdomain', error)
    errorMessage.value = 'Impossible d’enregistrer ce sous-domaine.'
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
    successMessage.value = 'Le sous-domaine a été libéré.'
  } catch (error) {
    console.error('[EditorDomainPanel] failed to delete subdomain', error)
    errorMessage.value = 'Impossible de libérer ce sous-domaine.'
  } finally {
    isDeleting.value = false
  }
}

watch(
  () => props.listingId,
  () => {
    void loadCurrentDomain()
  },
)

watch(subdomainInput, () => {
  availability.value = null
  errorMessage.value = null
  successMessage.value = null
})

onMounted(() => {
  void loadCurrentDomain()
})
</script>

<template>
  <section class="editor-domain-panel">
    <div class="header">
      <h3>Sous-domaine IndieHost</h3>
      <p>Réservez gratuitement un sous-domaine `*.{{ rootDomain }}` pour cette annonce.</p>
    </div>

    <div class="body">
      <div class="input">
        <input
          v-model="subdomainInput"
          type="text"
          placeholder="ex: mon-logement"
          autocomplete="off"
          @keydown.enter.prevent="checkAvailability"
        />
      </div>

      <p class="hint">
        URL publique : <strong>{{ previewUrl || `https://mon-logement.${rootDomain}` }}</strong>
      </p>

      <div class="actions">
        <div class="manage">
          <button
            type="button"
            :disabled="isCheckingAvailability || isLoadingCurrent"
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
        color: rgba($bad, 0.95);
      }
    }
  }
}
</style>
