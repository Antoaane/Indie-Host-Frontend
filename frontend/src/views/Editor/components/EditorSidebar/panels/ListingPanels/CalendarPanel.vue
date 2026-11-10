<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/CalendarPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import ConfirmationDialog from '@/components/overlays/ConfirmationDialog.vue'
import {
  buildListingCalendarExportUrl,
  deleteListingCalendarSource,
  fetchListingCalendarSyncSources,
  importListingCalendarSource,
  isListingCalendarApiConfigured,
  syncListingCalendarSource,
  type ListingCalendarSyncSource,
} from '@/domain/api/listingCalendar'
import { editorStatic } from '@/views/Editor/utils/editorContent'

const props = defineProps<{
  listingId: string
}>()

const panelContent = editorStatic.panels.listing.calendar

const sourceName = ref('')
const sourceUrl = ref('')
const sources = ref<ListingCalendarSyncSource[]>([])

const isLoadingSources = ref(false)
const isImporting = ref(false)
const refreshingSyncId = ref<string | null>(null)
const deletingSyncId = ref<string | null>(null)
const pendingDeleteSource = ref<ListingCalendarSyncSource | null>(null)
const isSourceBusy = computed(() => Boolean(refreshingSyncId.value || deletingSyncId.value))

const deleteConfirmMessage = computed(() => panelContent.sources.deleteConfirmMessage.replace(
  '{name}',
  pendingDeleteSource.value?.name || panelContent.sources.defaultName,
))

const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const exportUrl = computed(() => buildListingCalendarExportUrl(props.listingId))
const canCopyExportUrl = computed(() => Boolean(exportUrl.value))
const canManageSources = computed(() => isListingCalendarApiConfigured && Boolean(props.listingId.trim()))

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const responseData = (error as { response?: { data?: unknown } }).response?.data
    if (responseData && typeof responseData === 'object') {
      const apiMessage = normalizeText((responseData as { message?: unknown }).message)
      if (apiMessage) return apiMessage
    }

    const directMessage = normalizeText((error as { message?: unknown }).message)
    if (directMessage) return directMessage
  }

  return fallback
}

function isValidHttpUrl(value: string): boolean {
  const candidate = value.trim()
  if (!candidate) return false

  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function resetFeedback() {
  errorMessage.value = null
  successMessage.value = null
}

function formatDateTime(value?: string | null): string {
  if (!value) return panelContent.sources.neverSynced
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return panelContent.sources.neverSynced

  return parsed.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatSourceStatus(source: ListingCalendarSyncSource): string {
  const status = normalizeText(source.lastStatus).toLowerCase()
  if (status === 'ok') return panelContent.sources.statusOk
  if (status === 'error') return panelContent.sources.statusError
  if (status === 'syncing') return panelContent.sources.statusSyncing
  if (status) return status
  return panelContent.sources.statusUnknown
}

async function loadSources() {
  if (!canManageSources.value) {
    sources.value = []
    return
  }

  isLoadingSources.value = true

  try {
    sources.value = await fetchListingCalendarSyncSources(props.listingId)
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error, panelContent.sources.loadError)
    sources.value = []
  } finally {
    isLoadingSources.value = false
  }
}

async function addIcalSource() {
  if (isImporting.value) return

  resetFeedback()

  if (!canManageSources.value) {
    errorMessage.value = panelContent.sources.apiUnavailable
    return
  }

  const normalizedUrl = sourceUrl.value.trim()
  if (!isValidHttpUrl(normalizedUrl)) {
    errorMessage.value = panelContent.import.invalidUrl
    return
  }

  isImporting.value = true
  try {
    await importListingCalendarSource({
      listingId: props.listingId,
      name: sourceName.value.trim() || null,
      url: normalizedUrl,
    })

    sourceUrl.value = ''
    successMessage.value = panelContent.import.success
    await loadSources()
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error, panelContent.import.error)
  } finally {
    isImporting.value = false
  }
}

function askDeleteSource(source: ListingCalendarSyncSource) {
  if (isSourceBusy.value) return
  pendingDeleteSource.value = source
}

function closeDeleteDialog() {
  pendingDeleteSource.value = null
}

async function confirmDeleteSource() {
  const source = pendingDeleteSource.value
  pendingDeleteSource.value = null
  if (!source?.id || isSourceBusy.value) return

  resetFeedback()
  deletingSyncId.value = source.id

  try {
    await deleteListingCalendarSource({
      listingId: props.listingId,
      syncId: source.id,
    })
    sources.value = sources.value.filter((item) => item.id !== source.id)
    successMessage.value = panelContent.sources.deleteSuccess
    await loadSources()
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error, panelContent.sources.deleteError)
  } finally {
    deletingSyncId.value = null
  }
}

async function refreshSource(syncId: string) {
  if (!syncId || isSourceBusy.value) return

  resetFeedback()

  if (!canManageSources.value) {
    errorMessage.value = panelContent.sources.apiUnavailable
    return
  }

  refreshingSyncId.value = syncId

  try {
    const result = await syncListingCalendarSource({
      listingId: props.listingId,
      syncId,
    })

    if (result.status === 'failed') {
      errorMessage.value = result.lastError || panelContent.sources.syncError
    } else if (result.status === 'throttled') {
      successMessage.value = panelContent.sources.throttled
    } else {
      successMessage.value = panelContent.sources.syncSuccess
    }

    await loadSources()
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error, panelContent.sources.syncError)
  } finally {
    refreshingSyncId.value = null
  }
}

async function copyExportUrl() {
  if (!exportUrl.value) return

  resetFeedback()

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(exportUrl.value)
      successMessage.value = panelContent.export.copySuccess
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = exportUrl.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (!copied) {
      throw new Error('Copy command failed')
    }

    successMessage.value = panelContent.export.copySuccess
  } catch {
    errorMessage.value = panelContent.export.copyError
  }
}

function openExportUrl() {
  if (!exportUrl.value) return
  window.open(exportUrl.value, '_blank', 'noopener,noreferrer')
}

watch(
  () => props.listingId,
  () => {
    sourceName.value = ''
    sourceUrl.value = ''
    resetFeedback()
    void loadSources()
  },
)

onMounted(() => {
  void loadSources()
})
</script>

<template>
  <section class="editor-calendar-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="export">
        <p class="label">{{ panelContent.export.label }}</p>

        <div class="input">
          <input
            :value="exportUrl || panelContent.export.unavailable"
            type="text"
            readonly
            autocomplete="off"
          />
        </div>

        <div class="actions">
          <div class="manage">
            <button
              type="button"
              :disabled="!canCopyExportUrl"
              @click="copyExportUrl"
            >
              {{ panelContent.export.copyCta }}
            </button>
          </div>

          <div class="manage">
            <button
              type="button"
              :disabled="!canCopyExportUrl"
              @click="openExportUrl"
            >
              {{ panelContent.export.openCta }}
            </button>
          </div>
        </div>

        <p class="hint">{{ panelContent.export.hint }}</p>
      </div>

      <div class="import">
        <p class="label">{{ panelContent.import.label }}</p>

        <div class="input">
          <input
            v-model="sourceName"
            type="text"
            :placeholder="panelContent.import.namePlaceholder"
            autocomplete="off"
          />
        </div>

        <div class="input">
          <input
            v-model="sourceUrl"
            type="url"
            :placeholder="panelContent.import.urlPlaceholder"
            autocomplete="off"
            enterkeyhint="done"
            @keydown.enter.prevent="addIcalSource"
          />
        </div>

        <div class="actions">
          <div class="checkout">
            <button
              type="button"
              :disabled="isImporting || !canManageSources"
              @click="addIcalSource"
            >
              {{ isImporting ? panelContent.import.loading : panelContent.import.cta }}
            </button>
          </div>
        </div>

        <p
          v-if="!canManageSources"
          class="meta is-error"
        >
          {{ panelContent.sources.apiUnavailable }}
        </p>
      </div>

      <div class="sources">
        <p class="label">{{ panelContent.sources.title }}</p>

        <p
          v-if="isLoadingSources"
          class="meta"
        >
          {{ panelContent.sources.loading }}
        </p>

        <p
          v-else-if="!sources.length"
          class="meta"
        >
          {{ panelContent.sources.empty }}
        </p>

        <ul v-else>
          <li
            v-for="source in sources"
            :key="source.id"
            class="source-item"
          >
            <p class="source-name">{{ source.name || panelContent.sources.defaultName }}</p>
            <p class="source-url">{{ source.sourceUrl || panelContent.sources.noUrl }}</p>
            <p class="source-status">
              <strong>{{ panelContent.sources.statusLabel }}</strong> {{ formatSourceStatus(source) }}
            </p>
            <p class="source-status">
              <strong>{{ panelContent.sources.lastSyncLabel }}</strong> {{ formatDateTime(source.lastSyncedAt) }}
            </p>
            <p
              v-if="source.lastError"
              class="source-error"
            >
              {{ source.lastError }}
            </p>

            <div class="actions">
              <div class="manage">
                <button
                  type="button"
                  :disabled="isSourceBusy"
                  @click="refreshSource(source.id)"
                >
                  {{ refreshingSyncId === source.id ? panelContent.sources.syncing : panelContent.sources.syncCta }}
                </button>
              </div>

              <div class="danger">
                <button
                  type="button"
                  :disabled="isSourceBusy"
                  @click="askDeleteSource(source)"
                >
                  {{ deletingSyncId === source.id ? panelContent.sources.deleting : panelContent.sources.deleteCta }}
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <p
        v-if="successMessage"
        class="meta is-success"
      >
        {{ successMessage }}
      </p>
      <p
        v-if="errorMessage"
        class="meta is-error"
      >
        {{ errorMessage }}
      </p>
    </div>

    <ConfirmationDialog
      :open="Boolean(pendingDeleteSource)"
      :title="panelContent.sources.deleteConfirmTitle"
      :message="deleteConfirmMessage"
      :confirm-label="panelContent.sources.deleteConfirmCta"
      :cancel-label="panelContent.sources.deleteCancelCta"
      @close="closeDeleteDialog"
      @cancel="closeDeleteDialog"
      @confirm="confirmDeleteSource"
    />
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-calendar-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .export,
    > .import,
    > .sources {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);
      padding: var(--layout-gap-sm);
      border: 1px solid rgba($secondary, 0.1);
      border-radius: borders.$rounded-sm;

      > .label {
        margin: 0;
        @include little-text($thin: false);
        font-weight: 700;
      }

      > .hint {
        margin: 0;
        @include little-text($thin: false);
        color: rgba($secondary, 0.72);
      }

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
    }

    > .sources {
      > ul {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: var(--layout-gap-sm);

        > .source-item {
          display: flex;
          flex-direction: column;
          gap: calc(var(--layout-gap-xs) / 2);
          padding: var(--layout-gap-sm);
          border-radius: borders.$rounded-sm;
          border: 1px solid rgba($secondary, 0.12);

          > .source-name,
          > .source-url,
          > .source-status {
            margin: 0;
            @include little-text($thin: false);
            word-break: break-word;
          }

          > .source-name {
            font-weight: 700;
          }

          > .source-url {
            color: rgba($secondary, 0.75);
          }

          > .source-error {
            margin: 0;
            @include little-text($thin: false);
            color: $bad-ink;
          }

          // Les boutons de chaque source n'étaient pas stylés (bouton natif du navigateur).
          > .actions {
            display: flex;
            flex-wrap: wrap;
            gap: var(--layout-gap-xs);
            margin-top: calc(var(--layout-gap-xs) / 2);

            > .manage,
            > .danger {
              flex: 1 1 10rem;
              @include buttons.primary($theme: white, $fullwidth: true, $little: true);
            }

            // Action destructive signalée en rouge dès le repos : le survol n'existe pas au doigt.
            > .danger {
              > * {
                color: $bad-ink;
                outline-color: rgba($bad-ink, 0.25);
              }

              @include on-hover {
                > * {
                  color: $accent !important;
                  background-color: $bad-ink !important;
                }
              }
            }
          }
        }
      }
    }

    > .meta {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.72);

      &.is-success {
        color: $good-ink;
      }

      &.is-error {
        color: $bad-ink;
      }
    }
  }
}
</style>
