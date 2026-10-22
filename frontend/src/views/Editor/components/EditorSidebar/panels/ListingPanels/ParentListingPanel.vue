<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ParentListingPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { fetchListingParent, fetchOwnedHubs, setListingParent, type ListingHubSummary } from '@/domain/api/listingHubs'
import { readActiveUserId } from '@/router/backOfficeUser'

const props = defineProps<{
  listingId: string
  ownerId?: string | null
}>()

const emit = defineEmits<{
  (e: 'updated', payload: { listingId: string; parentListingId: string | null }): void
}>()

const content = {
  title: 'Page principale',
  subtitle: 'Rattachez ce logement à la page principale de votre site : il y sera présenté avec vos autres logements et restera accessible sous le même nom de domaine.',
  none: 'Aucune — annonce indépendante',
  empty: 'Vous n’avez pas encore de page principale. Créez-la depuis « Mes annonces » (bouton « Créer une page principale »).',
  save: 'Enregistrer',
  saving: 'Enregistrement...',
  attached: 'Annonce rattachée à « {title} ».',
  detached: 'Annonce détachée de sa page principale.',
}

const route = useRoute()
// Propriétaire dont on liste les pages : celui de l'éditeur courant (un admin édite au nom d'un client).
const ownerId = computed(() => props.ownerId ?? readActiveUserId(route.params.userId) ?? null)

const hubs = ref<ListingHubSummary[]>([])
const selectedHubId = ref('')
const currentParentId = ref<string | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const isDirty = computed(() => (selectedHubId.value || null) !== currentParentId.value)
const currentParent = computed(() => hubs.value.find((hub) => hub.listingId === currentParentId.value) ?? null)

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

async function load() {
  if (!props.listingId.trim()) return
  isLoading.value = true
  errorMessage.value = null
  successMessage.value = null
  try {
    const [ownedHubs, parent] = await Promise.all([
      fetchOwnedHubs({ ownerId: ownerId.value }),
      fetchListingParent(props.listingId),
    ])
    hubs.value = ownedHubs
    currentParentId.value = parent.parentListingId
    selectedHubId.value = parent.parentListingId ?? ''
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de charger les pages principales.')
  } finally {
    isLoading.value = false
  }
}

async function save() {
  if (!isDirty.value || isSaving.value) return
  errorMessage.value = null
  successMessage.value = null
  isSaving.value = true
  try {
    const result = await setListingParent(props.listingId, selectedHubId.value || null)
    currentParentId.value = result.parentListingId
    selectedHubId.value = result.parentListingId ?? ''
    emit('updated', { listingId: props.listingId, parentListingId: result.parentListingId })
    successMessage.value = result.parent
      ? content.attached.replace('{title}', result.parent.title)
      : content.detached
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de modifier la page principale.')
  } finally {
    isSaving.value = false
  }
}

watch(() => props.listingId, () => { void load() })
onMounted(() => { void load() })
</script>

<template>
  <section class="editor-parent-listing-panel">
    <div class="header">
      <h3>{{ content.title }}</h3>
      <p>{{ content.subtitle }}</p>
    </div>

    <div class="body">
      <p
        v-if="isLoading"
        class="meta"
      >
        Chargement...
      </p>

      <template v-else-if="hubs.length">
        <div class="select">
          <select
            v-model="selectedHubId"
            :disabled="isSaving"
            aria-label="Page principale de rattachement"
          >
            <option value="">{{ content.none }}</option>
            <option
              v-for="hub in hubs"
              :key="hub.listingId"
              :value="hub.listingId"
            >
              {{ hub.title }}{{ hub.hostname ? ` — ${hub.hostname}` : '' }}
            </option>
          </select>
        </div>

        <div class="actions">
          <div class="save">
            <button
              type="button"
              :disabled="!isDirty || isSaving"
              @click="save"
            >
              {{ isSaving ? content.saving : content.save }}
            </button>
          </div>
        </div>

        <p
          v-if="currentParent?.publicUrl"
          class="hint"
        >
          Visible sur
          <a
            :href="currentParent.publicUrl"
            target="_blank"
            rel="noreferrer"
          >{{ currentParent.hostname }}</a>
        </p>
      </template>

      <p
        v-else
        class="hint"
      >
        {{ content.empty }}
      </p>

      <p
        v-if="successMessage"
        class="meta is-success"
      >
        {{ successMessage }}
      </p>
      <p
        v-if="errorMessage"
        class="meta is-error"
        role="alert"
      >
        {{ errorMessage }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-parent-listing-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .select {
      @include inputs.field($theme: base);
    }

    > .actions > .save {
      @include buttons.primary($theme: white, $fullwidth: true);
    }

    > .hint {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.72);

      > a {
        color: $secondary;
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
