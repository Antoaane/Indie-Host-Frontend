// File: src/composables/useImportLoadingFeedback.ts

import { computed, onBeforeUnmount, ref } from 'vue'

export type ImportLoadingSource = 'airbnb' | 'booking'

type ImportLoadingStage = {
  max: number
  title: (sourceLabel: string) => string
  hint: string
  tip: string
}

const IMPORT_LOADING_STAGES: ImportLoadingStage[] = [
  {
    max: 18,
    title: (sourceLabel) => `Analyse du lien ${sourceLabel}`,
    hint: "On vérifie le format du lien et on prépare l'import.",
    tip: "L'import ne publie rien automatiquement: vous pourrez tout relire avant validation.",
  },
  {
    max: 42,
    title: (sourceLabel) => `Connexion à ${sourceLabel}`,
    hint: 'On récupère les informations principales de votre annonce.',
    tip: 'Un brouillon prérempli réduit fortement le temps nécessaire pour terminer votre onboarding.',
  },
  {
    max: 68,
    title: () => "Extraction des contenus de l'annonce",
    hint: 'On rassemble le titre, la description, les photos et les équipements.',
    tip: 'Le titre, les photos et les équipements resteront modifiables juste après l’import.',
  },
  {
    max: 88,
    title: () => 'Préparation du brouillon IndieHost',
    hint: 'On convertit les données au bon format pour préremplir votre annonce.',
    tip: 'Après l’import, complétez surtout le tarif, les frais et les règles voyageurs.',
  },
  {
    max: 99,
    title: () => 'Dernières vérifications',
    hint: 'On finalise les derniers détails pour afficher un résultat propre.',
    tip: 'Vous êtes à quelques instants d’un onboarding beaucoup plus rapide.',
  },
  {
    max: 100,
    title: () => 'Annonce prête',
    hint: "L'import est terminé.",
    tip: 'Il ne restera plus qu’à ajuster les derniers détails.',
  },
]

function sourceLabel(source: ImportLoadingSource) {
  return source === 'booking' ? 'Booking.com' : 'Airbnb'
}

function nextProgressDelta(progress: number) {
  if (progress < 18) return Math.random() * 4 + 4
  if (progress < 42) return Math.random() * 3 + 2.5
  if (progress < 68) return Math.random() * 2.2 + 1.8
  if (progress < 88) return Math.random() * 1.6 + 1
  return Math.random() * 0.8 + 0.35
}

export function useImportLoadingFeedback() {
  const progress = ref(0)
  const activeSource = ref<ImportLoadingSource>('airbnb')
  let timer: ReturnType<typeof setInterval> | null = null

  function clearTimer() {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  function tick() {
    if (progress.value >= 94) {
      clearTimer()
      return
    }

    progress.value = Math.min(94, progress.value + nextProgressDelta(progress.value))
  }

  function startImportLoadingFeedback(source: ImportLoadingSource) {
    clearTimer()
    activeSource.value = source
    progress.value = 8
    timer = setInterval(tick, 550)
  }

  async function completeImportLoadingFeedback() {
    clearTimer()
    progress.value = 100
    await new Promise((resolve) => {
      setTimeout(resolve, 260)
    })
  }

  function resetImportLoadingFeedback() {
    clearTimer()
    progress.value = 0
  }

  const progressPercent = computed(() => Math.max(0, Math.min(100, Math.round(progress.value))))
  const currentStage = computed(() => {
    const value = progressPercent.value
    return IMPORT_LOADING_STAGES.find((stage) => value <= stage.max) ?? IMPORT_LOADING_STAGES[IMPORT_LOADING_STAGES.length - 1]
  })
  const progressLabel = computed(() => `Import ${sourceLabel(activeSource.value)}`)
  const progressTitle = computed(() => currentStage.value.title(sourceLabel(activeSource.value)))
  const progressHint = computed(() => currentStage.value.hint)
  const progressTip = computed(() => currentStage.value.tip)

  onBeforeUnmount(() => {
    clearTimer()
  })

  return {
    progressPercent,
    progressLabel,
    progressTitle,
    progressHint,
    progressTip,
    startImportLoadingFeedback,
    completeImportLoadingFeedback,
    resetImportLoadingFeedback,
  }
}
