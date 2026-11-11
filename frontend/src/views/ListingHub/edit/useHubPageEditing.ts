// File: src/views/ListingHub/edit/useHubPageEditing.ts

// Mode édition de la page de présentation : applique chaque modification au contenu affiché, puis
// l'enregistre aussitôt (pas de bouton « Enregistrer », décision D4 de docs/editeur-de-page.md).
// Le composable ne sait pas où vont les données : la route du tableau de bord lui donne l'API et
// l'envoi ImageKit, la route de développement une mémoire locale.

import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

import { PAGE_LIMITS } from '@/domain/listings/hubPageContent'
import {
  createPageSection,
  type AddablePageSectionType,
  type HubPageContent,
  type PageSection,
  type PageThemeId,
} from '@/domain/listings/pageThemes'
import type { PageImageTarget } from '@/views/ListingHub/themed/ThemedHubPage.vue'

/** État de la page à enregistrer. */
export type HubPageSnapshot = {
  title: string
  /** Présente seulement quand la photo d'en-tête a changé depuis le dernier enregistrement réussi. */
  coverSrc?: string
  themeId: PageThemeId | null
  tagline: string
  location: string
  sections: PageSection[]
}

type UseHubPageEditingOptions = {
  content: Ref<HubPageContent>
  /** Thème choisi par l'hôte ; `null` tant qu'il garde le thème d'office. */
  themeId: Ref<PageThemeId | null>
  save: (snapshot: HubPageSnapshot) => Promise<void>
  /** Envoie la photo et rend son adresse définitive. */
  uploadImage: (file: File) => Promise<string>
}

const STATUS_MS = 2000
const UNDO_MS = 6000
const SAVING_MESSAGE = 'Enregistrement…'

function readErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : ''
  return message || fallback
}

export function useHubPageEditing(options: UseHubPageEditingOptions) {
  const { content, themeId } = options

  const status = ref('')
  const removed = ref<{ section: PageSection; index: number } | null>(null)
  const isSaving = ref(false)
  const saveFailed = ref(false)
  const uploads = ref(0)

  let statusTimer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  let coverDirty = false
  let activeRun: Promise<void> | null = null
  // Message affiché une fois la modification enregistrée, et délai pendant lequel « Annuler » reste proposé.
  let doneMessage = 'Enregistré'
  let doneKeepsUndo = false
  let sectionCounter = 0

  function clearStatusTimer() {
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = null
  }

  /** Message passager. `keepUndo` : il reste le temps de proposer « Annuler ». */
  function flash(message: string, keepUndo = false) {
    clearStatusTimer()
    status.value = message
    if (!keepUndo) removed.value = null
    statusTimer = setTimeout(() => {
      status.value = ''
      removed.value = null
    }, keepUndo ? UNDO_MS : STATUS_MS)
  }

  /** Message qui reste affiché jusqu'à la prochaine action (erreur, envoi en cours). */
  function hold(message: string) {
    clearStatusTimer()
    status.value = message
  }

  function buildSnapshot(): HubPageSnapshot {
    const current = content.value
    return {
      title: current.title,
      ...(coverDirty && current.coverSrc ? { coverSrc: current.coverSrc } : {}),
      themeId: themeId.value,
      tagline: current.tagline,
      location: current.location,
      sections: current.sections,
    }
  }

  // Un seul enregistrement à la fois ; une modification faite pendant qu'il part en déclenche un
  // autre aussitôt après, avec l'état le plus récent (la page est toujours envoyée en entier).
  async function runSaves() {
    isSaving.value = true
    try {
      while (dirty) {
        dirty = false
        const snapshot = buildSnapshot()
        hold(SAVING_MESSAGE)
        try {
          await options.save(snapshot)
          saveFailed.value = false
          if (snapshot.coverSrc && snapshot.coverSrc === content.value.coverSrc) coverDirty = false
        } catch (error) {
          saveFailed.value = true
          hold(readErrorMessage(error, 'Enregistrement impossible. Vérifiez votre connexion.'))
          return
        }
      }
      // Un autre message a pu s'afficher pendant l'envoi (limite atteinte, photo en cours) : il reste.
      if (status.value === SAVING_MESSAGE) flash(doneMessage, doneKeepsUndo)
    } finally {
      isSaving.value = false
    }
  }

  function commit(message = 'Enregistré', keepUndo = false) {
    doneMessage = message
    doneKeepsUndo = keepUndo
    dirty = true
    if (!keepUndo) removed.value = null
    if (activeRun) return
    activeRun = runSaves().finally(() => { activeRun = null })
  }

  /** Attend la fin des enregistrements en cours (avant de quitter la page). */
  async function flush(): Promise<void> {
    while (activeRun) await activeRun
  }

  function setSections(sections: PageSection[]) {
    content.value = { ...content.value, sections }
  }

  function selectTheme(id: PageThemeId) {
    if (themeId.value === id) return
    themeId.value = id
    commit()
  }

  function onUpdate(patch: Partial<Pick<HubPageContent, 'title' | 'tagline' | 'location'>>) {
    // Une page a toujours un titre : la saisie vide est ignorée (le champ reprend l'ancien texte).
    if (patch.title !== undefined && !patch.title.trim()) return
    content.value = { ...content.value, ...patch }
    commit()
  }

  function onUpdateSection(sectionId: string, patch: { title?: string; text?: string }) {
    setSections(content.value.sections.map((section) => (
      section.id === sectionId ? { ...section, ...patch } as PageSection : section
    )))
    commit()
  }

  function onAddSection(index: number, type: AddablePageSectionType) {
    const added = content.value.sections.filter((section) => section.type !== 'listings').length
    if (added >= PAGE_LIMITS.maxSections) {
      flash(`Votre page a déjà ${PAGE_LIMITS.maxSections} sections, le maximum. Supprimez-en une pour en ajouter.`)
      return
    }

    sectionCounter += 1
    const id = `s-${Date.now().toString(36)}-${sectionCounter}`
    const sections = [...content.value.sections]
    sections.splice(index, 0, createPageSection(type, id))
    setSections(sections)
    commit('Section ajoutée')
  }

  function onRemoveSection(sectionId: string) {
    const index = content.value.sections.findIndex((section) => section.id === sectionId)
    const section = content.value.sections[index]
    if (!section || section.type === 'listings') return
    setSections(content.value.sections.filter((item) => item.id !== sectionId))
    removed.value = { section, index }
    commit('Section supprimée.', true)
  }

  function onUndo() {
    if (!removed.value) return
    const { section, index } = removed.value
    const sections = [...content.value.sections]
    sections.splice(Math.min(index, sections.length), 0, section)
    setSections(sections)
    commit('Section rétablie')
  }

  function applyImage(target: PageImageTarget, url: string): boolean {
    if (target.kind === 'cover') {
      content.value = { ...content.value, coverSrc: url }
      coverDirty = true
      return true
    }

    let applied = false
    setSections(content.value.sections.map((section) => {
      if (section.id !== target.sectionId) return section
      if (section.type === 'text-image') {
        applied = true
        return { ...section, imageSrc: url }
      }
      if (section.type === 'gallery') {
        applied = true
        return { ...section, images: section.images.map((image, index) => (index === target.index ? url : image)) }
      }
      return section
    }))
    return applied
  }

  async function onPickImage(target: PageImageTarget, file: File) {
    if (!file.type.startsWith('image/')) {
      flash('Choisissez une image (JPG, PNG, WebP…).')
      return
    }

    uploads.value += 1
    removed.value = null
    hold('Envoi de la photo…')
    try {
      const url = await options.uploadImage(file)
      // La section a pu être supprimée pendant l'envoi : la photo n'a alors plus de place.
      if (applyImage(target, url)) commit('Photo enregistrée')
      else flash('')
    } catch (error) {
      hold(`Photo non envoyée. ${readErrorMessage(error, 'Réessayez dans un instant.')}`)
    } finally {
      uploads.value -= 1
    }
  }

  /** Relance l'enregistrement après un échec. */
  function retry() {
    commit()
  }

  onBeforeUnmount(clearStatusTimer)

  return {
    status,
    canUndo: computed(() => Boolean(removed.value)),
    canRetry: computed(() => saveFailed.value && !isSaving.value),
    /** Vrai tant qu'une modification n'est pas arrivée sur le serveur. */
    hasUnsavedChanges: computed(() => isSaving.value || saveFailed.value || uploads.value > 0),
    selectTheme,
    onUpdate,
    onUpdateSection,
    onAddSection,
    onRemoveSection,
    onUndo,
    onPickImage,
    retry,
    flush,
  }
}
