<!-- File: src/views/Management/_Management.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowUpRight, CalendarOff, Pen, Trash2 } from 'lucide-vue-next'

import DatePicker from '@/components/DatePicker/DatePicker.vue'
import ConfirmationDialog from '@/components/overlays/ConfirmationDialog.vue'
import { cancelReservationAsHost } from '@/domain/api/bookings'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { vp } from '@/utils/viewport'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'
import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import { deriveBookedDaysFromReservations, normalizeBookedDays, normalizeReservations } from '@/domain/listings/bookings'
import type { RawBookingReservation, RawBookings } from '@/domain/listings/types'
import type {
  ImportedBlock,
  Reservation,
  ReservationPaymentManualEntry,
  ReservationPaymentManualMethod,
} from '@/views/Management/utils/managementReservations'
import ManagementPaymentEditor from '@/views/Management/components/ManagementPaymentEditor.vue'
import ManagementSidebar from '@/views/Management/components/ManagementSidebar.vue'
import ManagementReservationSlider from '@/views/Management/components/ManagementReservationSlider.vue'
import ManagementScheduleCard from '@/views/Management/components/ManagementScheduleCard.vue'
import {
  MANUAL_PAYMENT_METHODS,
  buildImportedBlocksForListing,
  buildReservationsForListing,
  findClosestReservation,
  findClosestReservationForListing,
  normalizeManualPaymentEntries,
  resolveReservationPayment,
  resolveReservationPaymentSchedule,
  toRawReservationPayment,
} from '@/views/Management/utils/managementReservations'

const props = defineProps<{
  mode: EditorMode
  source: EditorSource
}>()
const route = useRoute()
const router = useRouter()

type ManagementStage = 'reservations' | 'calendar'
const LIVE_SYNC_INTERVAL_MS = 5000

const stage = ref<ManagementStage>('reservations')
const selectedListingId = ref<string | null>(null)
const selectedReservationId = ref<string | null>(null)
const isDeleteOverlayOpen = ref(false)
const isMobileStageOpen = ref(false)

// Logements uniquement : une page principale présente des logements, elle n'a ni calendrier ni
// réservations. Elle sert de titre de groupe dans la colonne (`pages`).
const listings = ref<UserListingCard[]>([])
const pages = ref<UserListingCard[]>([])
const listingsStatus = reactive({
  isLoading: false,
  error: null as unknown,
})

const reservationsStatus = reactive({
  isLoading: false,
  error: null as unknown,
})
const deleteStatus = reactive({
  isDeleting: false,
  error: null as string | null,
})
type PaymentEditorEntry = ReservationPaymentManualEntry
const DEFAULT_MANUAL_PAYMENT_METHOD: ReservationPaymentManualMethod = MANUAL_PAYMENT_METHODS[0]?.value ?? 'tpe_manual'
type PaymentEditorState = {
  total: number
  baseDeposit: number
  entries: PaymentEditorEntry[]
  draftAmount: number | null
  draftMethod: ReservationPaymentManualMethod
  draftDate: string
  draftComment: string
  isSaving: boolean
  error: string | null
  success: string | null
}

const paymentEditor = reactive<PaymentEditorState>({
  total: 0,
  baseDeposit: 0,
  entries: [],
  draftAmount: null,
  draftMethod: DEFAULT_MANUAL_PAYMENT_METHOD,
  draftDate: '',
  draftComment: '',
  isSaving: false,
  error: null,
  success: null,
})

let paymentSaveQueue: Promise<void> = Promise.resolve()
const noteEditor = reactive({
  value: '',
  isEditing: false,
  isSaving: false,
  error: null as string | null,
})
const internalNoteTextareaRef = ref<HTMLTextAreaElement | null>(null)

const reservationsByListingId = reactive<Record<string, Reservation[]>>({})
// Périodes bloquées par un calendrier importé (Airbnb, Booking…), montrées à part des réservations.
const importedBlocksByListingId = reactive<Record<string, ImportedBlock[]>>({})
const liveSyncState = reactive({
  inFlight: false,
  timerId: null as number | null,
})

const selectedListing = computed(() => listings.value.find((listing) => listing.listingId === selectedListingId.value) ?? null)
const isMobileViewport = computed(() => !vp.lg.value)
const isMobileManagementStep = computed(() => isMobileViewport.value && isMobileStageOpen.value && Boolean(selectedListingId.value))

const reservationsForListing = computed(() => {
  if (!selectedListingId.value) return []
  return reservationsByListingId[selectedListingId.value] ?? []
})

const stayRange = computed<RangeISO | null>(() => {
  const reservation = selectedReservation.value
  if (!reservation) return null
  return { start: reservation.start, end: reservation.end }
})

const stayMonthsCount = computed(() => {
  return vp.xxxl.value ? 2 : 1
})

const selectedReservation = computed(() => {
  const items = reservationsForListing.value
  if (!items.length) return null
  if (selectedReservationId.value) {
    const match = items.find((reservation) => reservation.id === selectedReservationId.value)
    if (match) return match
  }
  return items[0] ?? null
})

const importedBlocksForListing = computed<ImportedBlock[]>(() => {
  if (!selectedListingId.value) return []
  return importedBlocksByListingId[selectedListingId.value] ?? []
})

const importedBlocksTitle = computed(() => {
  const count = importedBlocksForListing.value.length
  return count > 1 ? `${count} périodes bloquées par un calendrier importé` : 'Une période bloquée par un calendrier importé'
})

const blockedRangesForListing = computed<RangeISO[]>(() => {
  return normalizeBookedDays([
    ...reservationsForListing.value.map((reservation) => ({
      start: reservation.start,
      end: reservation.end,
    })),
    ...importedBlocksForListing.value.map((block) => ({
      start: block.start,
      end: block.end,
    })),
  ])
})

const disabledStayRanges = computed<RangeISO[]>(() => {
  const activeReservation = selectedReservation.value
  if (!activeReservation) return blockedRangesForListing.value
  return normalizeBookedDays([
    ...reservationsForListing.value
      .filter((reservation) => reservation.id !== activeReservation.id)
      .map((reservation) => ({
        start: reservation.start,
        end: reservation.end,
      })),
    ...importedBlocksForListing.value.map((block) => ({
      start: block.start,
      end: block.end,
    })),
  ])
})

// Séjour mis en avant sur la carte de chaque logement : celui en cours, sinon le plus proche d'aujourd'hui.
const closestReservationByListingId = computed(() => {
  const map: Record<string, Reservation | null> = {}
  for (const listing of listings.value) {
    map[listing.listingId] = findClosestReservationForListing(reservationsByListingId[listing.listingId] ?? [])
  }
  return map
})

function resetReservationsMap() {
  for (const key of Object.keys(reservationsByListingId)) {
    delete reservationsByListingId[key]
  }
  for (const key of Object.keys(importedBlocksByListingId)) {
    delete importedBlocksByListingId[key]
  }
}

function areSameImportedBlocks(a: ImportedBlock[], b: ImportedBlock[]): boolean {
  if (a.length !== b.length) return false
  return a.every((block, index) => block.start === b[index]?.start && block.end === b[index]?.end)
}

function normalizeQueryParam(value: unknown): string | null {
  if (Array.isArray(value)) return normalizeQueryParam(value[0])
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function hasReservation(listingId: string, reservationId: string): boolean {
  return (reservationsByListingId[listingId] ?? []).some((reservation) => reservation.id === reservationId)
}

function findListingIdByReservation(reservationId: string): string | null {
  for (const [
    listingId,
    reservations,
  ] of Object.entries(reservationsByListingId)) {
    if (reservations.some((reservation) => reservation.id === reservationId)) {
      return listingId
    }
  }
  return null
}

function applyRouteSelection() {
  const listingIdFromQuery = normalizeQueryParam(route.query.listingId)
  const reservationIdFromQuery = normalizeQueryParam(route.query.reservationId)
  if (!listingIdFromQuery && !reservationIdFromQuery) return

  let nextListingId = listingIdFromQuery
  let nextReservationId = reservationIdFromQuery

  if (nextReservationId && nextListingId && !hasReservation(nextListingId, nextReservationId)) {
    nextListingId = null
  }

  if (nextReservationId && !nextListingId) {
    nextListingId = findListingIdByReservation(nextReservationId)
  }

  if (!nextListingId && listingIdFromQuery && reservationsByListingId[listingIdFromQuery]) {
    nextListingId = listingIdFromQuery
  }

  if (!nextListingId) return

  selectedListingId.value = nextListingId

  if (!nextReservationId || !hasReservation(nextListingId, nextReservationId)) {
    nextReservationId = findClosestReservationForListing(reservationsByListingId[nextListingId] ?? [])?.id ?? reservationsByListingId[nextListingId]?.[0]?.id ?? null
  }

  selectedReservationId.value = nextReservationId
  stage.value = 'reservations'
  isDeleteOverlayOpen.value = false
  if (isMobileViewport.value) {
    isMobileStageOpen.value = true
  }
}

async function loadListings() {
  listingsStatus.isLoading = true
  listingsStatus.error = null

  try {
    const fetched = await props.source.fetchListings()
    listings.value = fetched.filter((listing) => listing.kind !== 'hub')
    pages.value = fetched.filter((listing) => listing.kind === 'hub')
  } catch (err) {
    listingsStatus.error = err
    listings.value = []
    pages.value = []
  } finally {
    listingsStatus.isLoading = false
  }
}

async function loadReservations(sourceListings: UserListingCard[]) {
  reservationsStatus.isLoading = true
  reservationsStatus.error = null

  const results = await Promise.allSettled(
    sourceListings.map(async (listing) => {
      const volatile = await props.source.fetchVolatileListingBundle(listing.listingId)
      const reservations = buildReservationsForListing({
        listing,
        bookings: volatile.bookings ?? null,
      })
      reservationsByListingId[listing.listingId] = reservations
      importedBlocksByListingId[listing.listingId] = buildImportedBlocksForListing(volatile.bookings ?? null)
    }),
  )

  const failed = results.find((result) => result.status === 'rejected')
  if (failed && failed.status === 'rejected') {
    reservationsStatus.error = failed.reason
  }

  reservationsStatus.isLoading = false
}

function reservationRefKey(reservation: Reservation): string {
  if (reservation.id?.trim()) return `id:${reservation.id.trim()}`
  return `range:${reservation.start}__${reservation.end}`
}

function reservationSignature(reservation: Reservation): string {
  return JSON.stringify(reservation)
}

function withStableReservationReferences(previous: Reservation[], incoming: Reservation[]): Reservation[] {
  if (!previous.length || !incoming.length) return incoming

  const previousByKey = new Map<string, Reservation>()
  const previousSignatureByKey = new Map<string, string>()

  previous.forEach((reservation) => {
    const key = reservationRefKey(reservation)
    previousByKey.set(key, reservation)
    previousSignatureByKey.set(key, reservationSignature(reservation))
  })

  return incoming.map((reservation) => {
    const key = reservationRefKey(reservation)
    const previousReservation = previousByKey.get(key)
    if (!previousReservation) return reservation

    return previousSignatureByKey.get(key) === reservationSignature(reservation) ? previousReservation : reservation
  })
}

function areSameReservationList(a: Reservation[], b: Reservation[]): boolean {
  if (a.length !== b.length) return false
  return a.every((reservation, index) => reservation === b[index])
}

async function refreshReservationsInBackground() {
  if (liveSyncState.inFlight || reservationsStatus.isLoading) return
  if (deleteStatus.isDeleting || noteEditor.isSaving || paymentEditor.isSaving) return
  if (!listings.value.length) return

  liveSyncState.inFlight = true

  try {
    const snapshots = await Promise.allSettled(
      listings.value.map(async (listing) => {
        const volatile = await props.source.fetchVolatileListingBundle(listing.listingId)
        return {
          listingId: listing.listingId,
          reservations: buildReservationsForListing({
            listing,
            bookings: volatile.bookings ?? null,
          }),
          importedBlocks: buildImportedBlocksForListing(volatile.bookings ?? null),
        }
      }),
    )

    snapshots.forEach((snapshot) => {
      if (snapshot.status !== 'fulfilled') return

      const {
        listingId,
        reservations,
        importedBlocks,
      } = snapshot.value
      if (!areSameImportedBlocks(importedBlocksByListingId[listingId] ?? [], importedBlocks)) {
        importedBlocksByListingId[listingId] = importedBlocks
      }
      const previousReservations = reservationsByListingId[listingId] ?? []
      const nextReservations = withStableReservationReferences(previousReservations, reservations)
      if (!areSameReservationList(previousReservations, nextReservations)) {
        reservationsByListingId[listingId] = nextReservations
      }
    })
  } finally {
    liveSyncState.inFlight = false
  }
}

function stopLiveSync() {
  if (liveSyncState.timerId === null || typeof window === 'undefined') return
  window.clearInterval(liveSyncState.timerId)
  liveSyncState.timerId = null
}

function startLiveSync() {
  if (typeof window === 'undefined' || liveSyncState.timerId !== null) return
  liveSyncState.timerId = window.setInterval(() => {
    void refreshReservationsInBackground()
  }, LIVE_SYNC_INTERVAL_MS)
}

function handleVisibilityChange() {
  if (typeof document === 'undefined') return

  if (document.visibilityState === 'visible') {
    startLiveSync()
    void refreshReservationsInBackground()
    return
  }

  stopLiveSync()
}

function handleWindowFocus() {
  void refreshReservationsInBackground()
}

function selectDefaultReservation() {
  const closest = findClosestReservation(reservationsByListingId)
  if (closest) {
    selectedListingId.value = closest.listingId
    selectedReservationId.value = closest.reservation.id
    stage.value = 'reservations'
    return
  }

  if (listings.value.length) {
    selectedListingId.value = listings.value[0].listingId
    const closestForListing = findClosestReservationForListing(reservationsByListingId[selectedListingId.value] ?? [])
    selectedReservationId.value = closestForListing?.id ?? reservationsByListingId[selectedListingId.value]?.[0]?.id ?? null
    stage.value = 'reservations'
  }
}

async function bootstrap() {
  await loadListings()
  resetReservationsMap()
  await loadReservations(listings.value)
  selectDefaultReservation()
  applyRouteSelection()
}

function handleSelectListing(listingId: string) {
  if (!listingId.trim()) return
  isDeleteOverlayOpen.value = false
  if (isMobileViewport.value) {
    isMobileStageOpen.value = true
  }
  selectedListingId.value = listingId
  const fallback = findClosestReservationForListing(reservationsByListingId[listingId] ?? []) ?? reservationsByListingId[listingId]?.[0] ?? null
  selectedReservationId.value = fallback?.id ?? null
  stage.value = 'reservations'
}

function handleSelectReservation(reservationId: string) {
  isDeleteOverlayOpen.value = false
  if (isMobileViewport.value) {
    isMobileStageOpen.value = true
  }
  selectedReservationId.value = reservationId
  stage.value = 'reservations'
}

function handleBackToListings() {
  isDeleteOverlayOpen.value = false
  isMobileStageOpen.value = false
  stage.value = 'reservations'
}


function handleReplyToTraveler() {
  const listingId = selectedListingId.value
  const reservation = selectedReservation.value
  if (!listingId || !reservation) return

  const query: Record<string, string> = {
    listingId,
    reservationId: reservation.id,
  }
  const conversationId = reservation.messaging?.conversationId?.trim()
  if (conversationId) {
    query.conversationId = conversationId
  }

  void router.push({
    name: 'messaging',
    query,
  })
}

function normalizeInternalNote(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function buildInternalNoteDraftStorageKey(listingId: string, reservationId: string) {
  return `ihf.management.internal-note.${listingId}.${reservationId}`
}

function readInternalNoteDraft(listingId: string, reservationId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(buildInternalNoteDraftStorageKey(listingId, reservationId))
    return raw === null ? null : raw
  } catch {
    return null
  }
}

function writeInternalNoteDraft(listingId: string, reservationId: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(buildInternalNoteDraftStorageKey(listingId, reservationId), value)
  } catch {
    // Ignore localStorage write errors (quota/private mode).
  }
}

function clearInternalNoteDraft(listingId: string, reservationId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(buildInternalNoteDraftStorageKey(listingId, reservationId))
  } catch {
    // Ignore localStorage clear errors.
  }
}

function syncInternalNoteDraft() {
  const listingId = selectedListingId.value
  const reservation = selectedReservation.value
  if (!listingId || !reservation) return

  const currentPersisted = reservation.internalNote ?? ''
  if (noteEditor.value === currentPersisted) {
    clearInternalNoteDraft(listingId, reservation.id)
    return
  }

  writeInternalNoteDraft(listingId, reservation.id, noteEditor.value)
}

function handleInternalNoteInput() {
  noteEditor.error = null
  syncInternalNoteDraft()
}

async function openInternalNoteEditor() {
  if (!selectedReservation.value) return
  noteEditor.isEditing = true
  noteEditor.error = null

  await nextTick()
  internalNoteTextareaRef.value?.focus()
}

async function saveInternalNote() {
  const listingId = selectedListingId.value
  const reservation = selectedReservation.value
  if (!listingId || !reservation || noteEditor.isSaving) return false

  const nextNote = normalizeInternalNote(noteEditor.value)
  const currentNote = normalizeInternalNote(reservation.internalNote)
  if (nextNote === currentNote) {
    clearInternalNoteDraft(listingId, reservation.id)
    return true
  }

  noteEditor.isSaving = true
  noteEditor.error = null

  try {
    const editable = await props.source.fetchEditableListingBundle(listingId)
    const currentBookings = (editable.bookings ?? null) as Partial<RawBookings> | null
    const existingReservations = normalizeReservations(currentBookings?.reservations)
    let reservationIndex = existingReservations.findIndex((item) => item.id === reservation.id)

    if (reservationIndex < 0) {
      reservationIndex = existingReservations.findIndex((item) => item.start === reservation.start && item.end === reservation.end)
    }

    if (reservationIndex < 0) {
      throw new Error('Reservation not found')
    }

    const nextReservations = [
      ...existingReservations,
    ]
    const targetReservation = nextReservations[reservationIndex]
    nextReservations[reservationIndex] = {
      ...targetReservation,
      ...(nextNote ? { internalNote: nextNote } : { internalNote: undefined }),
    }

    const normalizedNextReservations = normalizeReservations(nextReservations)

    await props.source.patchListingDraft(listingId, {
      bookings: {
        ...(currentBookings ?? {}),
        reservations: normalizedNextReservations,
      },
    })

    reservationsByListingId[listingId] = reservationsByListingId[listingId].map((item) => {
      if (item.id !== reservation.id && !(item.start === reservation.start && item.end === reservation.end)) return item
      return {
        ...item,
        internalNote: nextNote || undefined,
      }
    })

    noteEditor.value = nextNote
    clearInternalNoteDraft(listingId, reservation.id)
    return true
  } catch (error) {
    console.error('[Management] save internal note failed', error)
    noteEditor.error = 'Impossible d’enregistrer la note interne.'
    return false
  } finally {
    noteEditor.isSaving = false
  }
}

async function handleInternalNoteBlur() {
  const saved = await saveInternalNote()
  if (!saved) return

  if (normalizeInternalNote(noteEditor.value)) {
    noteEditor.isEditing = false
  }
}

function todayIsoDate(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0')
  const day = String(referenceDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resetPaymentEditor(reservation: Reservation | null) {
  if (!reservation) {
    paymentEditor.total = 0
    paymentEditor.baseDeposit = 0
    paymentEditor.entries = []
    paymentEditor.draftAmount = null
    paymentEditor.draftMethod = DEFAULT_MANUAL_PAYMENT_METHOD
    paymentEditor.draftDate = todayIsoDate()
    paymentEditor.draftComment = ''
    paymentEditor.error = null
    paymentEditor.success = null
    return
  }

  paymentEditor.total = reservation.payment.total
  paymentEditor.baseDeposit = reservation.payment.baseDeposit
  paymentEditor.entries = reservation.payment.manual.entries.map((entry) => ({
    id: entry.id,
    amount: entry.amount,
    date: entry.date,
    method: entry.method,
    comment: entry.comment,
  }))
  paymentEditor.draftAmount = null
  paymentEditor.draftMethod = DEFAULT_MANUAL_PAYMENT_METHOD
  paymentEditor.draftDate = todayIsoDate()
  paymentEditor.draftComment = ''
  paymentEditor.error = null
  paymentEditor.success = null
}

function createManualEntryId(date: string) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)
  return `manual-${date}-${suffix}`
}

function updatePaymentEditorDraftAmount(value: number | null) {
  paymentEditor.draftAmount = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : null
  paymentEditor.error = null
  paymentEditor.success = null
}

function updatePaymentEditorDraftMethod(value: ReservationPaymentManualMethod) {
  paymentEditor.draftMethod = value
  paymentEditor.error = null
  paymentEditor.success = null
}

function updatePaymentEditorDraftDate(value: string) {
  paymentEditor.draftDate = value
  paymentEditor.error = null
  paymentEditor.success = null
}

function updatePaymentEditorDraftComment(value: string) {
  paymentEditor.draftComment = value
  paymentEditor.error = null
  paymentEditor.success = null
}

function queuePaymentSave() {
  paymentSaveQueue = paymentSaveQueue
    .then(async () => {
      await savePaymentChanges()
    })
    .catch(() => {
      // savePaymentChanges gère déjà l'erreur utilisateur.
    })
}

function addManualPaymentEntry() {
  const reservation = selectedReservation.value
  const preview = paymentPreview.value
  if (!reservation || !preview || !preview.canEditManualPayments) return

  const amount = Number(paymentEditor.draftAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    paymentEditor.error = 'Saisissez un montant manuel sup\u00e9rieur \u00e0 0.'
    return
  }

  const date = paymentEditor.draftDate.trim() || todayIsoDate()
  const [
    normalizedEntry,
  ] = normalizeManualPaymentEntries([
    {
      id: createManualEntryId(date),
      amount: Math.round(amount),
      date,
      method: paymentEditor.draftMethod,
      comment: paymentEditor.draftComment,
    },
  ])

  if (!normalizedEntry) {
    paymentEditor.error = 'Saisissez une date valide pour le paiement manuel.'
    return
  }

  paymentEditor.entries.push(normalizedEntry)
  paymentEditor.draftAmount = null
  paymentEditor.draftMethod = DEFAULT_MANUAL_PAYMENT_METHOD
  paymentEditor.draftDate = todayIsoDate()
  paymentEditor.draftComment = ''
  paymentEditor.error = null
  paymentEditor.success = null
  queuePaymentSave()
}

function removeManualPaymentEntry(entryId: string) {
  const preview = paymentPreview.value
  if (!preview || !preview.canEditManualPayments || paymentEditor.isSaving) return

  const nextEntries = paymentEditor.entries.filter((entry) => entry.id !== entryId)
  if (nextEntries.length === paymentEditor.entries.length) return

  paymentEditor.entries = nextEntries
  paymentEditor.error = null
  paymentEditor.success = null
  queuePaymentSave()
}

function findReservationIndexByIdOrRange(reservations: RawBookingReservation[], reservation: Reservation): number {
  const byId = reservations.findIndex((item) => item.id === reservation.id)
  if (byId >= 0) return byId
  return reservations.findIndex((item) => item.start === reservation.start && item.end === reservation.end)
}

async function savePaymentChanges() {
  const listingId = selectedListingId.value
  const reservation = selectedReservation.value
  const preview = paymentPreview.value

  if (!listingId || !reservation || !preview || paymentEditor.isSaving) return

  paymentEditor.isSaving = true
  paymentEditor.error = null
  paymentEditor.success = null

  try {
    const editable = await props.source.fetchEditableListingBundle(listingId)
    const currentBookings = (editable.bookings ?? null) as Partial<RawBookings> | null
    const existingReservations = normalizeReservations(currentBookings?.reservations)
    const manualEntries = normalizeManualPaymentEntries(paymentEditor.entries)
    const targetIndex = findReservationIndexByIdOrRange(existingReservations, reservation)

    if (targetIndex >= 0) {
      const targetReservation = existingReservations[targetIndex]
      const fallbackTotal = Math.max(0, Math.round(Number(targetReservation.payment?.total ?? preview.total) || preview.total))
      const nextPayment = resolveReservationPayment(targetReservation.payment, fallbackTotal, {
        total: paymentEditor.total,
        baseDeposit: paymentEditor.baseDeposit,
        manualEntries,
      })

      existingReservations[targetIndex] = {
        ...targetReservation,
        payment: toRawReservationPayment(nextPayment),
      }
    } else {
      const nextPayment = resolveReservationPayment(undefined, Math.max(0, paymentEditor.total || preview.total), {
        total: paymentEditor.total,
        baseDeposit: paymentEditor.baseDeposit,
        manualEntries,
      })

      const createdReservation: RawBookingReservation = {
        id: reservation.id,
        start: reservation.start,
        end: reservation.end,
        nights: reservation.nights,
        guestName: reservation.guestName,
        message: reservation.message,
        guests: reservation.guests,
        payment: toRawReservationPayment(nextPayment),
        ...(reservation.internalNote ? { internalNote: reservation.internalNote } : {}),
        ...(reservation.guestAvatar ? { guestAvatar: reservation.guestAvatar } : {}),
        ...(reservation.contact ? { contact: reservation.contact } : {}),
        ...(reservation.createdAt ? { createdAt: reservation.createdAt } : {}),
        ...(reservation.messaging ? { messaging: reservation.messaging } : {}),
      }

      existingReservations.push(createdReservation)
    }

    const nextReservations = normalizeReservations(existingReservations)

    await props.source.patchListingDraft(listingId, {
      bookings: {
        ...(currentBookings ?? {}),
        reservations: nextReservations,
      },
    })

    const listing = listings.value.find((item) => item.listingId === listingId)
    if (listing) {
      reservationsByListingId[listingId] = buildReservationsForListing({
        listing,
        bookings: {
          ...(currentBookings ?? {}),
          reservations: nextReservations,
        },
      })
    }

    const refreshed = (reservationsByListingId[listingId] ?? []).find((item) => item.id === reservation.id) ?? (reservationsByListingId[listingId] ?? []).find((item) => item.start === reservation.start && item.end === reservation.end)
    if (refreshed) {
      selectedReservationId.value = refreshed.id
    }

    paymentEditor.success = 'Paiements mis \u00e0 jour.'
  } catch (error) {
    console.error('[Management] update payment failed', error)
    paymentEditor.error = 'Impossible de mettre \u00e0 jour les paiements.'
  } finally {
    paymentEditor.isSaving = false
  }
}

// Réservation payée en ligne : l'hôte ne la supprime pas, il l'annule et le voyageur est remboursé
// intégralement par l'API (le montant est repris sur son compte Stripe).
const isSelectedReservationPaidOnline = computed(() => Boolean(selectedReservation.value?.payment.isStripeBacked))
const selectedReservationRefundLabel = computed(() => new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
}).format(selectedReservation.value?.payment.onlinePaid ?? 0))
const deleteDialogContent = computed(() => (isSelectedReservationPaidOnline.value
  ? {
      subject: 'Annulation de réservation',
      title: 'Annuler et rembourser le voyageur ?',
      message: `Le voyageur sera remboursé intégralement (${selectedReservationRefundLabel.value} payés en ligne), sur le moyen de paiement utilisé. Le montant est repris sur votre compte Stripe et les dates redeviennent disponibles.`,
      confirmLabel: deleteStatus.isDeleting ? 'Remboursement…' : 'Oui, annuler et rembourser',
    }
  : {
      subject: 'Suppression de réservation',
      title: 'Confirmer la suppression',
      message: 'Cette réservation sera supprimée définitivement.',
      confirmLabel: deleteStatus.isDeleting ? 'Suppression…' : 'Oui, supprimer',
    }))

function openDeleteOverlay() {
  if (!selectedReservation.value) return
  deleteStatus.error = null
  isDeleteOverlayOpen.value = true
}

function closeDeleteOverlay() {
  if (deleteStatus.isDeleting) return
  isDeleteOverlayOpen.value = false
}

async function confirmDeleteReservation() {
  const listingId = selectedListingId.value
  const reservation = selectedReservation.value
  if (!listingId || !reservation) return

  deleteStatus.isDeleting = true
  deleteStatus.error = null

  if (isSelectedReservationPaidOnline.value) {
    try {
      await cancelReservationAsHost({ reservationId: reservation.id })
      reservationsByListingId[listingId] = reservationsByListingId[listingId].filter((item) => item.id !== reservation.id)
      selectedReservationId.value = findClosestReservationForListing(reservationsByListingId[listingId] ?? [])?.id ?? reservationsByListingId[listingId]?.[0]?.id ?? null
      isDeleteOverlayOpen.value = false
    } catch (error) {
      console.error('[Management] host cancellation failed', error)
      deleteStatus.error = error instanceof Error ? error.message : 'Impossible d’annuler et de rembourser cette réservation.'
    } finally {
      deleteStatus.isDeleting = false
    }
    return
  }

  try {
    const editable = await props.source.fetchEditableListingBundle(listingId)
    const currentBookings = (editable.bookings ?? null) as Partial<RawBookings> | null
    const existingReservations = normalizeReservations(currentBookings?.reservations)

    let nextReservations = existingReservations.filter((item) => item.id !== reservation.id)

    if (nextReservations.length === existingReservations.length) {
      let removed = false
      nextReservations = existingReservations.filter((item) => {
        if (!removed && item.start === reservation.start && item.end === reservation.end) {
          removed = true
          return false
        }
        return true
      })
    }

    const nextBookedDays = existingReservations.length
      ? deriveBookedDaysFromReservations(nextReservations)
      : (() => {
          let removed = false
          return normalizeBookedDays(currentBookings?.['booked-days']).filter((item) => {
            if (!removed && item.start === reservation.start && item.end === reservation.end) {
              removed = true
              return false
            }
            return true
          })
        })()

    await props.source.patchListingDraft(listingId, {
      bookings: {
        ...(currentBookings ?? {}),
        reservations: nextReservations,
        'booked-days': nextBookedDays,
      },
    })

    reservationsByListingId[listingId] = reservationsByListingId[listingId].filter((item) => item.id !== reservation.id)
    selectedReservationId.value = findClosestReservationForListing(reservationsByListingId[listingId] ?? [])?.id ?? reservationsByListingId[listingId]?.[0]?.id ?? null

    isDeleteOverlayOpen.value = false
  } catch (error) {
    console.error('[Management] delete reservation failed', error)
    deleteStatus.error = 'Impossible de supprimer cette reservation.'
  } finally {
    deleteStatus.isDeleting = false
  }
}

watch(
  () => props.source,
  () => {
    isDeleteOverlayOpen.value = false
    isMobileStageOpen.value = false
    selectedListingId.value = null
    selectedReservationId.value = null
    stage.value = 'reservations'
    listings.value = []
    pages.value = []
    resetReservationsMap()
    void bootstrap()
  },
  { immediate: true },
)

watch(
  selectedReservation,
  (reservation) => {
    resetPaymentEditor(reservation)
  },
  { immediate: true },
)

watch(reservationsForListing, (items) => {
  if (!items.length) {
    selectedReservationId.value = null
    isDeleteOverlayOpen.value = false
    return
  }

  if (!selectedReservationId.value || !items.some((reservation) => reservation.id === selectedReservationId.value)) {
    selectedReservationId.value = findClosestReservationForListing(items)?.id ?? items[0].id
  }
})

watch(
  selectedReservation,
  (reservation) => {
    const listingId = selectedListingId.value
    const persistedNote = reservation?.internalNote ?? ''
    const draftNote = listingId && reservation ? readInternalNoteDraft(listingId, reservation.id) : null
    if (listingId && reservation && draftNote !== null && draftNote === persistedNote) {
      clearInternalNoteDraft(listingId, reservation.id)
    }

    noteEditor.value = draftNote ?? persistedNote
    noteEditor.isEditing = !normalizeInternalNote(noteEditor.value) || (draftNote !== null && draftNote !== persistedNote)
    noteEditor.isSaving = false
    noteEditor.error = null
  },
  { immediate: true },
)

watch(
  () => [
    route.query.listingId,
    route.query.reservationId,
    listings.value.length,
    reservationsStatus.isLoading,
  ],
  () => {
    if (reservationsStatus.isLoading) return
    applyRouteSelection()
  },
)

watch(
  isMobileViewport,
  () => {
    isMobileStageOpen.value = false
  },
  { immediate: true },
)

watch(selectedListingId, (listingId) => {
  if (listingId) return
  isMobileStageOpen.value = false
})

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    if (document.visibilityState === 'visible') {
      startLiveSync()
      void refreshReservationsInBackground()
    }
  } else {
    startLiveSync()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleWindowFocus)
  }
})

onBeforeUnmount(() => {
  stopLiveSync()

  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('focus', handleWindowFocus)
  }
})

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso?: string | null) {
  if (!iso) return ''
  const [
    year,
    month,
    day,
  ] = iso.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatDateRange(start?: string, end?: string) {
  if (!start || !end) return ''
  return `du ${formatDate(start)} au ${formatDate(end)}`
}

const guestLines = computed(() => {
  const guests = selectedReservation.value?.guests
  if (!guests) return []
  const lines: string[] = []

  if (guests.adults) lines.push(`${guests.adults} adulte${guests.adults > 1 ? 's' : ''}`)
  if (guests.children) lines.push(`${guests.children} enfant${guests.children > 1 ? 's' : ''}`)
  if (guests.infants) lines.push(`${guests.infants} b\u00e9b\u00e9${guests.infants > 1 ? 's' : ''}`)
  if (guests.pets) lines.push(`${guests.pets} ${guests.pets > 1 ? 'animaux' : 'animal'}`)
  if (guests.pmr) lines.push(`${guests.pmr} personne${guests.pmr > 1 ? 's' : ''} PMR`)

  return lines
})

function formatDateLong(iso?: string | null) {
  if (!iso) return ''
  const [
    year,
    month,
    day,
  ] = iso.split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatNights(nights: number) {
  return `${nights} ${nights > 1 ? 'nuits' : 'nuit'}`
}

// Mêmes initiales que dans la barre des réservations (prénom + nom).
function guestInitials(name: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'IH'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

// L'essentiel du séjour, en quatre lignes.
const stayFacts = computed(() => {
  const reservation = selectedReservation.value
  if (!reservation) return []
  return [
    { label: 'Arrivée', value: formatDateLong(reservation.start) },
    { label: 'Départ', value: formatDateLong(reservation.end) },
    { label: 'Durée', value: formatNights(reservation.nights) },
    { label: 'Voyageurs', value: guestLines.value.join(', ') || 'Non précisé' },
  ]
})

const paymentPreview = computed(() => {
  const reservation = selectedReservation.value
  if (!reservation) return null

  return resolveReservationPayment(reservation.payment, reservation.payment.total, {
    total: paymentEditor.total,
    baseDeposit: paymentEditor.baseDeposit,
    manualEntries: paymentEditor.entries,
  })
})

const paymentSchedule = computed(() => {
  const payment = paymentPreview.value
  const reservation = selectedReservation.value
  if (!payment) return null

  return resolveReservationPaymentSchedule(payment, {
    fallbackDueDateISO: reservation?.start ?? null,
  })
})

const paymentScheduleProgressWidth = computed(() => `${paymentSchedule.value?.completionPercent ?? 0}%`)
const paymentScheduleProgressClass = computed(() => (paymentSchedule.value?.completionPercent ?? 0) >= 100 ? 'is-complete' : 'is-incomplete')
const canEditManualPayments = computed(() => Boolean(paymentPreview.value?.canEditManualPayments))

const shouldShowInternalNoteEditor = computed(() => noteEditor.isEditing || !normalizeInternalNote(noteEditor.value))
</script>

<template>
  <section
    id="management-page"
    class="management"
  >
    <div
      class="layout"
      :class="{ 'is-mobile-stage': isMobileManagementStep }"
    >
      <ManagementSidebar
        :listings="listings"
        :pages="pages"
        :isLoading="listingsStatus.isLoading"
        :error="listingsStatus.error"
        :selectedListingId="selectedListingId"
        :closestReservationByListingId="closestReservationByListingId"
        @select="handleSelectListing"
      />

      <div
        class="stage-shell"
        :class="{ 'is-mobile-open': isMobileManagementStep }"
      >
        <section class="stage">
          <div class="content">
            <!-- Sur mobile, la barre porte le retour aux annonces : elle reste
                 affichée même sans réservation, sinon le panneau est une impasse. -->
            <div
              v-if="reservationsForListing.length > 1 || isMobileViewport"
              class="reservation-toolbar"
            >
              <div
                v-if="isMobileViewport"
                class="mobile-back-shell"
              >
                <button
                  type="button"
                  aria-label="Retour aux annonces"
                  title="Retour aux annonces"
                  @click="handleBackToListings"
                >
                  <ArrowLeft :size="18" />
                </button>
              </div>

              <ManagementReservationSlider
                v-if="reservationsForListing.length > 1"
                :reservations="reservationsForListing"
                :activeReservationId="selectedReservationId"
                @select="handleSelectReservation"
              />

            </div>

            <div class="reservation-body">
              <Transition name="editor-stage">
                <div
                  v-show="stage === 'reservations'"
                  class="reservation-panel"
                >
                  <template v-if="selectedReservation">
                    <header class="reservation-heading">
                      <div class="avatar">
                        <img
                          v-if="selectedReservation.guestAvatar"
                          :src="selectedReservation.guestAvatar"
                          alt=""
                          loading="lazy"
                        />
                        <span v-else>{{ guestInitials(selectedReservation.guestName) }}</span>
                      </div>
                      <div class="title">
                        <h2>{{ selectedReservation.guestName }}</h2>
                        <p>{{ selectedListing?.title }}</p>
                      </div>
                      <div class="reply">
                        <button
                          type="button"
                          @click="handleReplyToTraveler"
                        >
                          &Eacute;crire au voyageur
                          <ArrowUpRight
                            :size="16"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </header>

                    <section
                      v-if="selectedReservation.message.trim()"
                      class="detail-section message-section"
                    >
                      <h3>Message du voyageur</h3>
                      <p class="message">{{ selectedReservation.message }}</p>
                    </section>

                    <section class="detail-section stay-section">
                      <h3>S&eacute;jour</h3>
                      <div class="stay-container">
                        <dl class="stay-facts">
                          <div
                            v-for="fact in stayFacts"
                            :key="fact.label"
                          >
                            <dt>{{ fact.label }}</dt>
                            <dd>{{ fact.value }}</dd>
                          </div>
                        </dl>
                        <div class="stay-calendar">
                          <DatePicker
                            :model-value="stayRange"
                            :disabled-dates="disabledStayRanges"
                            :number-of-months="stayMonthsCount"
                            :read-only="true"
                            :allow-navigation-in-read-only="true"
                            :allow-disabled-model-value="true"
                            :exclude-model-value-from-disabled="true"
                            :restrict-to-future="false"
                          />
                          <p class="legend">Les jours barr&eacute;s sont d&eacute;j&agrave; pris ou bloqu&eacute;s.</p>
                        </div>
                      </div>
                    </section>

                    <section class="detail-section schedule-section">
                      <h3>Paiements</h3>
                      <template v-if="paymentPreview && paymentSchedule">
                        <div class="schedule-overview">
                          <div class="amounts">
                            <p class="paid">
                              <strong>{{ formatCurrency(paymentSchedule.paidTotal) }}</strong>
                              encaiss&eacute; sur {{ formatCurrency(paymentPreview.total) }}
                            </p>
                            <p
                              class="balance"
                              :class="{ 'is-complete': paymentSchedule.balance <= 0 }"
                            >
                              <template v-if="paymentSchedule.balance > 0">
                                Reste &agrave; r&eacute;gler&nbsp;: <strong>{{ formatCurrency(paymentSchedule.balance) }}</strong>
                              </template>
                              <template v-else>S&eacute;jour enti&egrave;rement r&eacute;gl&eacute;</template>
                            </p>
                          </div>
                          <div
                            class="progress-track"
                            role="progressbar"
                            aria-label="Part du s&eacute;jour d&eacute;j&agrave; encaiss&eacute;e"
                            :aria-valuenow="paymentSchedule.completionPercent"
                            aria-valuemin="0"
                            aria-valuemax="100"
                          >
                            <span
                              class="progress-fill"
                              :class="paymentScheduleProgressClass"
                              :style="{ width: paymentScheduleProgressWidth }"
                            />
                          </div>
                        </div>

                        <ManagementScheduleCard
                          :schedule="paymentSchedule"
                          :method-label="paymentPreview.method"
                          :is-stripe-backed="paymentPreview.isStripeBacked"
                          :can-remove-manual-entries="canEditManualPayments"
                          :is-saving="paymentEditor.isSaving"
                          :format-currency="formatCurrency"
                          :format-date="formatDate"
                          @remove-manual-entry="removeManualPaymentEntry"
                        />

                        <ManagementPaymentEditor
                          :draft-amount="paymentEditor.draftAmount"
                          :draft-method="paymentEditor.draftMethod"
                          :draft-date="paymentEditor.draftDate"
                          :draft-comment="paymentEditor.draftComment"
                          :manual-payment-methods="MANUAL_PAYMENT_METHODS"
                          :is-saving="paymentEditor.isSaving"
                          :can-edit-manual-payments="canEditManualPayments"
                          :reset-key="selectedReservation.id"
                          :error="paymentEditor.error"
                          :success="paymentEditor.success"
                          @update:draft-amount="updatePaymentEditorDraftAmount"
                          @update:draft-method="updatePaymentEditorDraftMethod"
                          @update:draft-date="updatePaymentEditorDraftDate"
                          @update:draft-comment="updatePaymentEditorDraftComment"
                          @add-manual-entry="addManualPaymentEntry"
                        />
                      </template>
                    </section>

                    <section class="detail-section note-section">
                      <div class="section-head">
                        <h3>Note interne</h3>
                        <p>Vous seul la voyez.</p>
                      </div>

                      <template v-if="shouldShowInternalNoteEditor">
                        <textarea
                          ref="internalNoteTextareaRef"
                          v-model="noteEditor.value"
                          class="internal-note-input"
                          rows="3"
                          aria-label="Note interne sur cette r&eacute;servation"
                          :disabled="noteEditor.isSaving"
                          placeholder="Préférences, rappels, points de vigilance…"
                          @input="handleInternalNoteInput"
                          @blur="handleInternalNoteBlur"
                        />
                      </template>
                      <div
                        v-else
                        class="internal-note-preview"
                      >
                        <p>{{ selectedReservation.internalNote }}</p>
                        <button
                          type="button"
                          class="edit-note-btn"
                          aria-label="Modifier la note interne"
                          title="Modifier la note interne"
                          @click="openInternalNoteEditor"
                        >
                          <Pen :size="16" />
                        </button>
                      </div>

                      <p
                        v-if="noteEditor.error"
                        class="feedback error"
                        role="alert"
                      >
                        {{ noteEditor.error }}
                      </p>
                    </section>

                    <section class="delete-reservation">
                      <div class="danger">
                        <button
                          type="button"
                          :disabled="deleteStatus.isDeleting"
                          @click="openDeleteOverlay"
                        >
                          <Trash2
                            :size="16"
                            aria-hidden="true"
                          />
                          {{ isSelectedReservationPaidOnline ? 'Annuler et rembourser' : 'Supprimer la réservation' }}
                        </button>
                      </div>
                      <p
                        v-if="deleteStatus.error"
                        class="error"
                        role="alert"
                      >
                        {{ deleteStatus.error }}
                      </p>
                    </section>
                  </template>

                  <div
                    v-else
                    class="reservation-empty"
                  >
                    <template v-if="reservationsForListing.length">
                      S&eacute;lectionnez une r&eacute;servation pour afficher le d&eacute;tail.
                    </template>
                    <template v-else-if="selectedListing">
                      Aucune r&eacute;servation pour ce logement pour le moment.
                    </template>
                    <template v-else>
                      Aucun logement &agrave; afficher pour le moment.
                    </template>
                  </div>

                  <!-- Dates venues d'Airbnb ou de Booking : elles bloquent le calendrier, mais ce ne
                       sont pas des réservations IndieHost (ni voyageur, ni montant, ni paiement). -->
                  <section
                    v-if="importedBlocksForListing.length"
                    class="imported-blocks"
                    aria-labelledby="management-imported-blocks-title"
                  >
                    <div class="heading">
                      <CalendarOff
                        :size="18"
                        aria-hidden="true"
                      />
                      <div>
                        <h3 id="management-imported-blocks-title">{{ importedBlocksTitle }}</h3>
                        <p>
                          Ces dates viennent d&rsquo;Airbnb, de Booking ou d&rsquo;un autre calendrier que vous avez
                          import&eacute;. Elles sont indisponibles sur votre page ; la r&eacute;servation et son paiement
                          se g&egrave;rent sur la plateforme d&rsquo;origine.
                        </p>
                      </div>
                    </div>
                    <ul>
                      <li
                        v-for="block in importedBlocksForListing"
                        :key="`${block.start}__${block.end}`"
                      >
                        <span class="dates">{{ formatDateRange(block.start, block.end) }}</span>
                        <span class="nights">{{ block.nights }} {{ block.nights > 1 ? 'nuits' : 'nuit' }}</span>
                      </li>
                    </ul>
                  </section>
                </div>
              </Transition>

            </div>
          </div>
        </section>
      </div>
    </div>
  </section>

  <ConfirmationDialog
    :open="isDeleteOverlayOpen"
    :subject="deleteDialogContent.subject"
    :title="deleteDialogContent.title"
    :message="deleteDialogContent.message"
    :confirm-label="deleteDialogContent.confirmLabel"
    cancel-label="Annuler"
    :confirm-disabled="deleteStatus.isDeleting"
    :cancel-disabled="deleteStatus.isDeleting"
    @close="closeDeleteOverlay"
    @cancel="closeDeleteOverlay"
    @confirm="confirmDeleteReservation"
  />
</template>

<style lang="scss">
@use '@/views/Management/management.scss';
</style>
