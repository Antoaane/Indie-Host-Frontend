<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebar.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Home, LayoutGrid, Pencil } from 'lucide-vue-next'

import BaseSidebar from '@/components/layouts/BaseSidebar.vue'
import EditorSidebarNav from '@/views/Editor/components/EditorSidebar/EditorSidebarNav.vue'
import ListingPanels from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ListingPanels.vue'
import PricingPanels from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/PricingPanels.vue'
import ArrivalPanels from '@/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalPanels.vue'
import type { AttachableListing } from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/HubChildrenPanel.vue'
import {
  computeEditorSectionCompletion,
  computeEditorSectionSummaries,
  EDITOR_SECTIONS_KEY,
  findEditorGroupOfSection,
  findEditorSectionLabel,
  resolveEditorGroups,
  type EditorGroupId,
  type EditorListingContext,
  type EditorSectionId,
} from '@/views/Editor/components/EditorSidebar/editorSections'
import type { RawListingBundle } from '@/domain/listings/types'
import type { ListingDomainRecord } from '@/domain/api/listingDomains'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { buildPageEditorRoute, readEditorRouteUserId } from '@/views/Editor/utils/pageEditorRoute'

type SuccessFeedback = 'publish' | 'publishAll' | 'cancel' | null

const props = defineProps<{
  listingId: string
  draft: RawListingBundle
  showMobileBack?: boolean
  isLoading?: boolean
  isPatchSyncing?: boolean
  /** Horodatage du dernier enregistrement du brouillon dans cette session. */
  lastSavedAt?: number | null
  hasPendingChanges?: boolean
  hasAnyPendingChanges?: boolean
  hasMultiplePendingListings?: boolean
  pendingListingsCount?: number
  canPublishListing?: boolean
  isAdmin?: boolean
  /** Profil de l'hôte (statut particulier / professionnel) : il n'est pas dans le brouillon modifiable. */
  host?: RawListingBundle['host']
  /** Place de l'annonce : sa page principale, ou les logements qu'elle présente. */
  context?: EditorListingContext
  /** Logements du même hôte sans page principale (pour le panneau « Logements présentés »). */
  attachableListings?: AttachableListing[]
  /** Section à ouvrir pour une annonce donnée (demandée depuis « Mes annonces »). */
  focusSection?: { listingId: string; section: EditorSectionId } | null
  publishAllPending: () => Promise<void>
  cancelPendingChanges: () => Promise<void>
  publish: () => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
  (e: 'domain-updated', domain: ListingDomainRecord): void
  (e: 'mobile-back'): void
  (e: 'select-listing', listingId: string): void
  (e: 'links-changed'): void
  (e: 'focus-consumed'): void
}>()

const sidebarContent = editorStatic.sidebar
const pageContent = editorStatic.panels.listing.hubPage
const route = useRoute()

// Page principale : son contenu et son thème se modifient sur la page elle-même. L'entrée est en
// tête de colonne, toujours visible, et non dans une section à déplier.
const pageEditorRoute = computed(() => buildPageEditorRoute(props.listingId, readEditorRouteUserId(route.params.userId)))

const isHubListing = computed(() => props.draft.core?.kind === 'hub')
const groups = computed(() => resolveEditorGroups(isHubListing.value))

const group = ref<EditorGroupId>('essentials')
// Une seule section ouverte à la fois : la colonne reste courte, et se lit comme un sommaire.
const openSection = ref<EditorSectionId | null>(null)

const listingTitle = computed(() => {
  const title = typeof props.draft.core?.title === 'string' ? props.draft.core.title.trim() : ''
  return title || (isHubListing.value ? 'Page principale sans titre' : 'Annonce sans titre')
})

// Où se situe l'annonce : page principale et ses logements, logement d'une page, ou logement seul.
const contextLine = computed(() => {
  if (isHubListing.value) {
    const total = props.context?.childrenCount ?? 0
    if (!total) return 'Page principale, sans logement pour le moment'
    return `Page principale · présente ${total} logement${total > 1 ? 's' : ''}`
  }
  return props.context?.parentTitle ? 'Logement de la page' : 'Logement indépendant'
})

// Le statut du loueur s'enregistre hors brouillon (`listingHost.ts`) : on part du profil chargé avec
// l'annonce, puis on suit ce que le panneau « Légal » vient d'enregistrer.
const hostOverride = ref<Record<string, unknown>>({})
const draftWithHost = computed<RawListingBundle>(() => ({
  ...props.draft,
  host: { ...(props.host ?? {}), ...(props.draft.host ?? {}), ...hostOverride.value },
}))

const sectionSummaries = computed(() => computeEditorSectionSummaries(draftWithHost.value, props.context))

const incompleteSections = computed<Partial<Record<EditorSectionId, boolean>>>(() => {
  const completion = computeEditorSectionCompletion(draftWithHost.value)
  const result: Partial<Record<EditorSectionId, boolean>> = {}
  for (const [sectionId, isComplete] of Object.entries(completion)) {
    if (isComplete === false) result[sectionId as EditorSectionId] = true
  }
  return result
})

const isPublishing = ref(false)
const isCancelling = ref(false)
const error = ref<string | null>(null)
const successFeedback = ref<SuccessFeedback>(null)
const successTimer = ref<number | null>(null)
const applyToAllPending = ref(false)

const showApplyToAllToggle = computed(() => Boolean(props.hasMultiplePendingListings))

// ---------------------------------------------------------------------------
// État d'enregistrement : brouillon automatique (350 ms après la frappe) puis
// « Appliquer » pour pousser vers la version en ligne. Le bandeau le dit en clair.
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

const saveState = computed<'saving' | 'pending' | 'upToDate'>(() => {
  if (props.isPatchSyncing) return 'saving'
  if (props.hasPendingChanges) return 'pending'
  return 'upToDate'
})

const saveStateText = computed(() => {
  if (saveState.value === 'saving') return sidebarContent.status.saving
  if (saveState.value === 'pending') return sidebarContent.status.pending
  return sidebarContent.status.upToDate
})

// Seconde ligne, plus discrète : l'heure du dernier enregistrement du brouillon.
const saveStateDetail = computed(() => {
  if (saveState.value !== 'pending' || !props.lastSavedAt) return ''
  return sidebarContent.status.savedAt.replace('{time}', timeFormatter.format(new Date(props.lastSavedAt)))
})

// ---------------------------------------------------------------------------
// Sections repliables.
const incompleteGroups = computed<Partial<Record<EditorGroupId, boolean>>>(() => {
  const result: Partial<Record<EditorGroupId, boolean>> = {}
  for (const candidate of groups.value) {
    result[candidate.id] = candidate.sections.some((section) => incompleteSections.value[section.id] === true)
  }
  return result
})

const sidebarRef = ref<{ $el?: HTMLElement } | null>(null)

function bodyElement(): HTMLElement | null {
  return sidebarRef.value?.$el?.querySelector?.<HTMLElement>(':scope > .base-sidebar__body') ?? null
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// La section ouverte remonte en haut de la colonne : celle qu'on vient de fermer au-dessus
// libère de la place, et sans cela le contenu ouvert se retrouverait hors de l'écran.
async function revealSection(sectionId: EditorSectionId) {
  await nextTick()
  const body = bodyElement()
  const element = body?.querySelector<HTMLElement>(`.editor-section[data-section="${sectionId}"]`)
  if (!body || !element) return
  const top = element.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop
  body.scrollTo({ top: Math.max(0, top - 8), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

async function openSectionById(sectionId: EditorSectionId) {
  const targetGroup = findEditorGroupOfSection(sectionId)
  if (targetGroup !== group.value) {
    group.value = targetGroup
    await nextTick()
  }
  openSection.value = sectionId
  await revealSection(sectionId)
}

function toggleSection(sectionId: EditorSectionId) {
  if (openSection.value === sectionId) {
    openSection.value = null
    return
  }
  void openSectionById(sectionId)
}

// Un groupe d'une seule section s'ouvre directement : une ligne repliée seule n'apporterait rien.
function resetOpenSectionForGroup() {
  const sections = groups.value.find((candidate) => candidate.id === group.value)?.sections ?? []
  openSection.value = sections.length === 1 ? sections[0]?.id ?? null : null
}

provide(EDITOR_SECTIONS_KEY, {
  isOpen: (sectionId) => openSection.value === sectionId,
  toggle: toggleSection,
  labelOf: (sectionId) => findEditorSectionLabel(sectionId),
  summaryOf: (sectionId) => sectionSummaries.value[sectionId] ?? '',
  isTodo: (sectionId) => incompleteSections.value[sectionId] === true,
})

// Un nouveau groupe s'ouvre en haut, pas à la position de défilement du précédent.
watch(group, () => {
  const body = bodyElement()
  if (body) body.scrollTop = 0
  resetOpenSectionForGroup()
})

watch(groups, (nextGroups) => {
  if (!nextGroups.some((candidate) => candidate.id === group.value)) {
    group.value = nextGroups[0]?.id ?? 'essentials'
  }
  resetOpenSectionForGroup()
}, { immediate: true })

// ---------------------------------------------------------------------------
const canPublish = computed(() => {
  if (props.isLoading || isPublishing.value || isCancelling.value) return false
  if (showApplyToAllToggle.value && applyToAllPending.value) {
    return Boolean(props.hasAnyPendingChanges)
  }
  return Boolean(props.hasPendingChanges)
})
const canCancel = computed(() => !props.isLoading && !isPublishing.value && !isCancelling.value && Boolean(props.hasPendingChanges))
const isActionRunning = computed(() => isPublishing.value || isCancelling.value)
const successFeedbackText = computed(() => {
  if (successFeedback.value === 'publishAll') {
    return sidebarContent.success.publishAll ?? sidebarContent.success.publish
  }
  if (successFeedback.value === 'cancel') {
    return sidebarContent.success.cancel ?? sidebarContent.success.publish
  }
  return sidebarContent.success.publish
})
const applyToAllLabel = computed(() => {
  const count = props.pendingListingsCount ?? 0
  if (count > 1) return `${sidebarContent.actions.applyAllPending} (${count})`
  return sidebarContent.actions.applyAllPending
})

function handlePatch(patch: DraftPatch) {
  emit('patch', patch)
}

function clearSuccessFeedback() {
  if (successTimer.value) {
    window.clearTimeout(successTimer.value)
    successTimer.value = null
  }
  successFeedback.value = null
}

function showSuccessFeedback(type: Exclude<SuccessFeedback, null> = 'publish') {
  clearSuccessFeedback()
  successFeedback.value = type
  successTimer.value = window.setTimeout(() => {
    successFeedback.value = null
    successTimer.value = null
  }, 2200)
}

watch(
  () => props.listingId,
  () => {
    group.value = 'essentials'
    hostOverride.value = {}
    error.value = null
    applyToAllPending.value = false
    clearSuccessFeedback()
    const body = bodyElement()
    if (body) body.scrollTop = 0
    resetOpenSectionForGroup()
  },
)

watch(
  () => [props.focusSection, props.listingId] as const,
  async ([request, listingId]) => {
    if (!request || request.listingId !== listingId) return
    emit('focus-consumed')
    await nextTick()
    void openSectionById(request.section)
  },
  { immediate: true },
)

watch(showApplyToAllToggle, (enabled) => {
  if (!enabled) {
    applyToAllPending.value = false
  }
})

async function publishDraft() {
  if (!canPublish.value) return
  error.value = null

  const shouldPublishAll = showApplyToAllToggle.value && applyToAllPending.value

  isPublishing.value = true
  try {
    if (shouldPublishAll) {
      await props.publishAllPending()
      showSuccessFeedback('publishAll')
    } else {
      await props.publish()
      showSuccessFeedback('publish')
    }
  } catch (err: any) {
    error.value = err?.message ?? (shouldPublishAll ? (sidebarContent.errors.publishAll ?? sidebarContent.errors.publish) : sidebarContent.errors.publish)
  } finally {
    isPublishing.value = false
  }
}

async function cancelDraftChanges() {
  if (!canCancel.value) return
  error.value = null

  isCancelling.value = true
  try {
    await props.cancelPendingChanges()
    showSuccessFeedback('cancel')
  } catch (err: any) {
    error.value = err?.message ?? (sidebarContent.errors.cancel ?? sidebarContent.errors.publish)
  } finally {
    isCancelling.value = false
  }
}

onBeforeUnmount(() => {
  clearSuccessFeedback()
})
</script>

<template>
  <BaseSidebar
    ref="sidebarRef"
    class="editor-sidebar"
    :class="{ 'is-action-running': isActionRunning }"
    body-scrollable
  >
    <template #header>
      <div class="sidebar-head">
        <Transition name="editor-sidebar-feedback">
          <p
            v-if="successFeedback"
            class="action-feedback"
            role="status"
            aria-live="polite"
          >
            {{ successFeedbackText }}
          </p>
        </Transition>

        <div class="identity">
          <span
            class="icon"
            aria-hidden="true"
          >
            <LayoutGrid
              v-if="isHubListing"
              :size="18"
            />
            <Home
              v-else
              :size="18"
            />
          </span>
          <div class="text">
            <h2>{{ listingTitle }}</h2>
            <p>
              {{ contextLine }}
              <button
                v-if="!isHubListing && props.context?.parentId && props.context?.parentTitle"
                type="button"
                @click="emit('select-listing', props.context.parentId)"
              >
                {{ props.context.parentTitle }}
              </button>
            </p>
          </div>
        </div>

        <div
          v-if="isHubListing"
          class="page-cta"
        >
          <div class="link">
            <RouterLink :to="pageEditorRoute">
              <Pencil
                :size="18"
                aria-hidden="true"
              />
              {{ pageContent.cta }}
            </RouterLink>
          </div>
          <p>{{ pageContent.subtitle }}</p>
        </div>

        <div
          class="save-state"
          :class="`is-${saveState}`"
        >
          <p
            class="text"
            role="status"
            aria-live="polite"
          >
            <span
              class="dot"
              aria-hidden="true"
            />
            <span class="lines">
              <span class="line">{{ saveStateText }}</span>
              <span
                v-if="saveStateDetail"
                class="detail"
              >{{ saveStateDetail }}</span>
            </span>
          </p>

          <div class="actions">
            <div
              v-if="props.hasPendingChanges"
              class="btn is-cancel"
            >
              <button
                type="button"
                :disabled="!canCancel"
                :aria-label="sidebarContent.actions.cancelAria"
                @click="cancelDraftChanges"
              >
                {{ sidebarContent.actions.cancel }}
              </button>
            </div>
            <div class="btn is-apply">
              <button
                type="button"
                :disabled="!canPublish"
                :aria-label="sidebarContent.actions.applyAria"
                :aria-busy="isPublishing"
                @click="publishDraft"
              >
                {{ sidebarContent.actions.apply }}
              </button>
            </div>
          </div>
        </div>

        <label
          v-if="showApplyToAllToggle"
          class="apply-all-toggle"
        >
          <input
            v-model="applyToAllPending"
            type="checkbox"
            :disabled="isActionRunning || !!props.isLoading"
          >
          <span>{{ applyToAllLabel }}</span>
        </label>

        <p
          v-if="error"
          class="error"
          role="alert"
        >
          {{ error }}
        </p>

        <EditorSidebarNav
          v-model="group"
          :groups="groups"
          :incompleteGroups="incompleteGroups"
          :showMobileBack="props.showMobileBack"
          @mobile-back="emit('mobile-back')"
        />
      </div>
    </template>

    <Transition
      name="editor-sidebar-panels"
      mode="out-in"
    >
      <ListingPanels
        v-if="group === 'essentials' || group === 'addresses' || group === 'settings'"
        :key="group"
        :group="group"
        :listing-id="props.listingId"
        :draft="draftWithHost"
        :canPublishListing="props.canPublishListing"
        :isAdmin="props.isAdmin"
        :attachableListings="props.attachableListings"
        @patch="handlePatch"
        @domain-updated="emit('domain-updated', $event)"
        @select-listing="emit('select-listing', $event)"
        @links-changed="emit('links-changed')"
        @host-updated="hostOverride = { ...hostOverride, ...$event }"
      />
      <PricingPanels
        v-else-if="group === 'pricing'"
        :draft="props.draft"
        @patch="handlePatch"
      />
      <ArrivalPanels
        v-else
        :core="props.draft.core"
        :arrival="props.draft.arrival"
        @patch="handlePatch"
      />
    </Transition>
  </BaseSidebar>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/editor-sidebar.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/buttons' as buttons;

.editor-sidebar {
  position: relative;

  > .base-sidebar__header > .sidebar-head {
    position: relative;
    width: 100%;
    padding: 0.5rem;

    display: flex;
    flex-direction: column;
    gap: var(--layout-gap-xs);

    border-radius: borders.$rounded-xl;
    background-color: $accent;

    > .action-feedback {
      margin: 0;
      padding: 0.45rem 0.75rem;

      position: absolute;
      top: 0.25rem;
      right: 0.25rem;
      z-index: 5;

      border-radius: borders.$rounded-sm;
      background-color: rgba($good, 0.92);
      @include little-text($ink-static, $bold: true);
      line-height: 1.2;

      pointer-events: none;
    }

    // Identité : quelle annonce on modifie, et où elle se situe (page principale, logement d'une page).
    > .identity {
      padding: 0.25rem 0.5rem 0;
      display: flex;
      align-items: center;
      gap: var(--layout-gap-sm);
      min-width: 0;

      > .icon {
        flex: 0 0 auto;
        width: 2.25rem;
        height: 2.25rem;
        display: grid;
        place-items: center;
        border-radius: borders.inner(borders.$rounded-xl, 0.75rem);
        background: rgba($secondary, 0.06);
        color: $secondary;
      }

      > .text {
        min-width: 0;

        > h2 {
          margin: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          @include base-text($secondary, $bold: true);
        }

        > p {
          margin: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          @include little-text(rgba($secondary-text, 0.72), $thin: false);

          > button {
            padding: 0;
            border: 0;
            background: none;
            color: $secondary;
            text-decoration: underline;
            cursor: pointer;
            @include little-text($secondary, $bold: true);

            &:focus-visible {
              outline: 2px solid $secondary;
              outline-offset: 2px;
            }
          }
        }
      }
    }

    // Page principale : entrée du mode édition sur la page (textes, photos, thème).
    > .page-cta {
      padding: 0.25rem 0.5rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-2xs);
      border-bottom: 1px solid rgba($secondary, 0.06);

      > .link {
        @include buttons.primary($theme: black, $fullwidth: true);

        > a {
          border-radius: borders.inner(borders.$rounded-xl, 0.75rem);
        }
      }

      > p {
        margin: 0;
        @include little-text(rgba($secondary-text, 0.72), $thin: false);
      }
    }

    // Bandeau d'état : ce qui est enregistré, ce qui est en ligne, et le bouton pour appliquer.
    > .save-state {
      min-height: 2.5rem;
      padding: 0.15rem 0.25rem 0.15rem 0.5rem;

      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--layout-gap-sm);

      > .text {
        margin: 0;
        min-width: 0;

        display: inline-flex;
        align-items: center;
        gap: 0.5rem;

        @include little-text(rgba($secondary-text, 0.75), $thin: false);

        > .lines {
          min-width: 0;
          display: flex;
          flex-direction: column;
          line-height: 1.2;

          > .line {
            text-wrap: balance;
          }

          > .detail {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: rgba($secondary-text, 0.55);
          }
        }

        > .dot {
          flex: 0 0 auto;
          width: 0.5rem;
          height: 0.5rem;
          border-radius: borders.$rounded;
          background: $good-ink;
          @include animations.transition(animations.$duration-base, animations.$ease-out, (background-color, opacity));
        }
      }

      > .actions {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: var(--layout-gap-xs);

        > .btn.is-apply {
          @include buttons.primary($cta: true, $theme: dark, $little: true);
        }

        > .btn.is-cancel {
          @include buttons.primary($theme: white, $little: true);
        }
      }

      &.is-pending > .text {
        color: $secondary-text;

        > .dot {
          background: $progressing;
          box-shadow: 0 0 0 1px rgba($secondary, 0.12);
        }
      }

      &.is-saving > .text > .dot {
        background: rgba($secondary, 0.35);
      }
    }

    > .apply-all-toggle {
      margin: 0 0.5rem;
      width: auto;
      justify-content: flex-start;
      @include buttons.checkbox-label(white);
    }

    > .error {
      margin: 0 0.5rem;
      @include little-text($bad-ink, $thin: false);
    }

    > .editor-sidebar-nav {
      padding-top: 0.25rem;
      border-top: 1px solid rgba($secondary, 0.06);
    }
  }

  > .base-sidebar__body {
    border-radius: borders.$rounded-xl;
    overscroll-behavior: contain;
    scroll-padding-top: var(--layout-gap-xs);
  }

  &.is-action-running {
    > .base-sidebar__header > .sidebar-head > .editor-sidebar-nav,
    > .base-sidebar__body {
      pointer-events: none;
      user-select: none;
    }
  }
}

// Changement de groupe : fréquent, donc sortie instantanée et entrée courte.
.editor-sidebar-panels-enter-active {
  @include animations.transition(animations.$duration-fast, animations.$ease-out, opacity);
}

.editor-sidebar-panels-enter-from,
.editor-sidebar-panels-leave-to {
  opacity: 0;
}

.editor-sidebar-panels-enter-to,
.editor-sidebar-panels-leave-from {
  opacity: 1;
}

.editor-sidebar-feedback-enter-active {
  @include animations.transition(animations.$duration-menu, animations.$ease-out, (opacity, transform));
}

.editor-sidebar-feedback-leave-active {
  @include animations.transition(animations.$duration-exit, animations.$ease-out, (opacity, transform));
}

.editor-sidebar-feedback-enter-from,
.editor-sidebar-feedback-leave-to {
  opacity: 0;
  transform: translateY(-8px);

  @include animations.reduced-motion {
    transform: none;
  }
}

.editor-sidebar-feedback-enter-to,
.editor-sidebar-feedback-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
