<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/RoomsPanel.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Armchair,
  Baby,
  Bed,
  BedDouble,
  BedSingle,
  Minus,
  Plus,
  Sofa,
  Trash2,
  X,
} from 'lucide-vue-next'
import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, normalizeTextInput, resolveTextMaxLength } from '@/utils/inputValidation'

type RoomDraft = NonNullable<RawCore['rooms']>[number]
type BedDraft = NonNullable<NonNullable<RoomDraft['beds']>[number]>
type BedDraftExtended = BedDraft & {
  customName?: string
  customIcon?: string
}
type RoomDraftExtended = Omit<RoomDraft, 'beds'> & {
  beds?: BedDraftExtended[]
}
type BedTypeOption = {
  value: string
  label: string
  capacity: number
  icon?: string
}

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const rooms = computed<RoomDraftExtended[]>(() => (props.core?.rooms as RoomDraftExtended[] | undefined) ?? [])

const panelContent = editorStatic.panels.listing.rooms
const roomTypeOptions = panelContent.types
const bedTypeOptions = panelContent.bedTypes as BedTypeOption[]
const customBedContent = (panelContent as Record<string, any>).customBed ?? {
  typeValue: 'custom',
  fallbackName: 'Lit personnalisé',
  nameLabel: 'Nom du lit',
  namePlaceholder: 'Ex : Canapé-lit',
  iconLabel: 'Icône',
  capacityLabel: 'Capacité',
  addButton: 'Ajouter le lit',
  doneButton: 'Terminé',
  overlayAriaLabel: 'Ajouter un lit',
}
const customIconChoices = Array.isArray(customBedContent.iconChoices) && customBedContent.iconChoices.length
  ? customBedContent.iconChoices
  : [
      { value: 'bed-single', label: 'Lit simple' },
      { value: 'bed-double', label: 'Lit double' },
      { value: 'bed-bunk', label: 'Lit superposé' },
      { value: 'bed-sofa', label: 'Canapé-lit' },
    ]

const roomTypeLabels = Object.fromEntries(
  roomTypeOptions.map((option) => [
    option.value,
    option.label,
  ]),
) as Record<string, string>
const bedTypeCapacities = Object.fromEntries(
  bedTypeOptions.map((option) => [
    normalizeText(option.value),
    option.capacity,
  ]),
) as Record<string, number>
const bedTypeLabels = Object.fromEntries(
  bedTypeOptions.map((option) => [
    normalizeText(option.value),
    option.label,
  ]),
) as Record<string, string>

const NON_SLEEPING_ROOM_TYPES = new Set([
  'kitchen',
  'bathroom',
])
const OTHER_ROOM_TYPE = 'other'
const CUSTOM_BED_TYPE = normalizeText(customBedContent.typeValue ?? 'custom')
const roomsLimits = editorStatic.validation.listing.rooms
const roomsLimitsRecord = roomsLimits as Record<string, unknown>
const textDefaults = editorStatic.validation.defaults.simpleText
const roomNameMaxLength = resolveTextMaxLength(roomsLimits.roomNameMax, textDefaults)
const customBedNameMaxLength = resolveTextMaxLength(roomsLimitsRecord.customBedNameMax, textDefaults)
const customBedCapacityMin = clampInteger(roomsLimitsRecord.bedCapacityMin, 1, 8, 1)
const customBedCapacityMax = clampInteger(roomsLimitsRecord.bedCapacityMax, customBedCapacityMin, 12, 4)

const bedIconComponents = {
  'bed-single': BedSingle,
  'bed-double': BedDouble,
  'bed-bunk': Bed,
  'bed-sofa': Sofa,
  'bed-futon': Armchair,
  'bed-baby': Baby,
  'bed-custom': Bed,
} as const

type BedIconKey = keyof typeof bedIconComponents

const fallbackBedIconByType: Record<string, BedIconKey> = {
  simple: 'bed-single',
  double: 'bed-double',
  bunk: 'bed-bunk',
  'sofa-bed': 'bed-sofa',
  futon: 'bed-futon',
  crib: 'bed-baby',
  custom: 'bed-custom',
}

const knownBedTypes = new Set(Object.keys(bedTypeCapacities))
const customIconChoiceSet = new Set(customIconChoices.map((choice: { value: string }) => choice.value))

const bedTypeIcons = Object.fromEntries(
  bedTypeOptions.map((option) => {
    const normalized = normalizeText(option.value)
    const fallbackIcon = fallbackBedIconByType[normalized] ?? 'bed-single'
    return [
      normalized,
      sanitizeBedIconKey(option.icon ?? fallbackIcon),
    ]
  }),
) as Record<string, BedIconKey>

const defaultCustomIcon = sanitizeBedIconKey(customIconChoices[0]?.value ?? 'bed-single')
const overlayDoneButtonLabel = String(customBedContent.doneButton ?? 'Terminé')

const bedOverlayTitleId = `rooms-bed-overlay-title-${Math.random().toString(36).slice(2, 9)}`
const activeBedOverlayRoomIndex = ref<number | null>(null)

const isBedOverlayOpen = computed(() => activeBedOverlayRoomIndex.value !== null)
const activeOverlayRoomIndex = computed(() => activeBedOverlayRoomIndex.value ?? -1)
const activeOverlayRoom = computed(() => {
  const index = activeBedOverlayRoomIndex.value
  if (index === null) return null
  return rooms.value[index] ?? null
})

const roomBedSummaries = computed(() => rooms.value.map((room) => buildBedSummary(room)))
const roomDisplayLabels = computed(() => {
  const baseLabels = rooms.value.map((room, index) => roomLabel(room, index))
  const totals = new Map<string, number>()
  const seen = new Map<string, number>()

  baseLabels.forEach((label) => {
    const key = normalizeText(label)
    totals.set(key, (totals.get(key) ?? 0) + 1)
  })

  return baseLabels.map((label) => {
    const key = normalizeText(label)
    const total = totals.get(key) ?? 0
    if (total <= 1) return label
    const order = (seen.get(key) ?? 0) + 1
    seen.set(key, order)
    return `${label} ${order}`
  })
})

watch(
  rooms,
  (nextRooms) => {
    const hasInvalidBeds = nextRooms.some(
      (room) => isNonSleepingRoomType(room.type) && (room.beds?.length ?? 0) > 0,
    )
    if (!hasInvalidBeds) return
    setRooms(nextRooms)
  },
  { deep: true, immediate: true },
)

watch(
  rooms,
  (nextRooms) => {
    const index = activeBedOverlayRoomIndex.value
    if (index === null) return
    const room = nextRooms[index]
    if (!room || isBedConfigDisabled(room)) {
      closeBedOverlay()
    }
  },
  { deep: true },
)

watch(
  activeBedOverlayRoomIndex,
  (nextIndex) => {
    if (nextIndex === null) return
    const room = rooms.value[nextIndex]
    if (!room || isBedConfigDisabled(room)) {
      closeBedOverlay()
    }
  },
)

function setRooms(next: RoomDraftExtended[]) {
  const sanitized = next.map((room) => {
    const roomName = normalizeTextInput(String(room['room-name'] ?? ''), roomNameMaxLength).trim()
    const baseRoom = {
      ...room,
      'room-name': roomName || panelContent.roomLabelGeneric,
    } as RoomDraftExtended

    if (!isNonSleepingRoomType(baseRoom.type) && Array.isArray(baseRoom.beds)) {
      return {
        ...baseRoom,
        beds: baseRoom.beds.map((bed) => sanitizeBed(bed as BedDraftExtended)),
      } as RoomDraftExtended
    }

    if (!Array.isArray(baseRoom.beds) || baseRoom.beds.length === 0) return baseRoom
    return {
      ...baseRoom,
      beds: [],
    } as RoomDraftExtended
  })

  emit('patch', { core: { rooms: sanitized as RoomDraft[] } })
}

function addRoom() {
  const next = [
    ...rooms.value,
  ]
  const defaultType = roomTypeOptions[0]?.value ?? 'bedroom'
  next.push({
    'room-name': roomTypeLabels[defaultType] ?? panelContent.roomLabelGeneric,
    type: defaultType,
    beds: [],
  } as RoomDraftExtended)
  setRooms(next)
}

function removeRoom(index: number) {
  const next = rooms.value.filter((_, idx) => idx !== index)
  setRooms(next)

  if (activeBedOverlayRoomIndex.value === index) {
    closeBedOverlay()
    return
  }

  if (activeBedOverlayRoomIndex.value !== null && activeBedOverlayRoomIndex.value > index) {
    activeBedOverlayRoomIndex.value -= 1
  }
}

function updateRoom(index: number, patch: Partial<RoomDraftExtended>) {
  const next = [
    ...rooms.value,
  ]
  if (!next[index]) return
  next[index] = { ...next[index], ...patch }
  setRooms(next)
}

function setBeds(index: number, nextBeds: BedDraftExtended[]) {
  const next = [
    ...rooms.value,
  ]
  if (!next[index]) return
  next[index] = {
    ...next[index],
    beds: nextBeds,
  }
  setRooms(next)
}

function updateBed(roomIndex: number, bedIndex: number, patch: Partial<BedDraftExtended>) {
  if (isBedConfigDisabled(rooms.value[roomIndex])) return
  const next = [
    ...(rooms.value[roomIndex]?.beds ?? []),
  ] as BedDraftExtended[]
  if (!next[bedIndex]) return

  const nextPatch: Partial<BedDraftExtended> = {
    ...patch,
    ...(Object.prototype.hasOwnProperty.call(patch, 'quantity')
      ? { quantity: sanitizeBedQuantity(patch.quantity) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'capacity')
      ? { capacity: sanitizeBedCapacity(patch.capacity) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'customName')
      ? { customName: normalizeTextInput(String(patch.customName ?? ''), customBedNameMaxLength) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'customIcon')
      ? { customIcon: sanitizeCustomBedIcon(patch.customIcon) }
      : {}),
  }

  next[bedIndex] = {
    ...next[bedIndex],
    ...nextPatch,
  }
  setBeds(roomIndex, next)
}

function removeBed(roomIndex: number, bedIndex: number) {
  if (isBedConfigDisabled(rooms.value[roomIndex])) return
  const next = (rooms.value[roomIndex]?.beds ?? []).filter((_, index) => index !== bedIndex) as BedDraftExtended[]
  setBeds(roomIndex, next)
}

function setRoomType(index: number, nextType: string) {
  const room = rooms.value[index]
  if (!room) return

  const normalizedType = normalizeRoomType(nextType)
  const patch: Partial<RoomDraftExtended> = {
    type: normalizedType,
    'room-name': roomTypeLabels[normalizedType] ?? panelContent.roomLabelGeneric,
  }

  if (isOtherRoomType(normalizedType)) {
    patch['room-name'] = roomCustomName(room) || roomTypeLabels[OTHER_ROOM_TYPE] || panelContent.roomLabelGeneric
  }

  if (isNonSleepingRoomType(normalizedType)) {
    patch.beds = []
  }

  updateRoom(index, patch)
}

function setCustomRoomName(index: number, nextName: string) {
  const fallbackLabel = roomTypeLabels[OTHER_ROOM_TYPE] ?? panelContent.roomLabelGeneric
  const normalizedName = normalizeTextInput(nextName, roomNameMaxLength).trim()
  updateRoom(index, { 'room-name': normalizedName || fallbackLabel })
}

function setBedType(roomIndex: number, bedIndex: number, nextType: string) {
  if (isBedConfigDisabled(rooms.value[roomIndex])) return

  const resolvedType = resolveBedType(nextType)
  if (resolvedType === CUSTOM_BED_TYPE) {
    const currentBed = rooms.value[roomIndex]?.beds?.[bedIndex] as BedDraftExtended | undefined
    updateBed(roomIndex, bedIndex, {
      type: CUSTOM_BED_TYPE,
      capacity: sanitizeBedCapacity(currentBed?.capacity),
      customName: normalizeTextInput(String(currentBed?.customName ?? ''), customBedNameMaxLength)
        || customBedContent.fallbackName,
      customIcon: sanitizeCustomBedIcon(currentBed?.customIcon),
    })
    return
  }

  updateBed(roomIndex, bedIndex, {
    type: resolvedType,
    capacity: bedTypeCapacities[resolvedType] ?? customBedCapacityMin,
    customName: undefined,
    customIcon: undefined,
  })
}

function openBedOverlay(roomIndex: number) {
  const room = rooms.value[roomIndex]
  if (!room || isBedConfigDisabled(room)) return
  activeBedOverlayRoomIndex.value = roomIndex
}

function closeBedOverlay() {
  activeBedOverlayRoomIndex.value = null
}

function addBedFromOverlay() {
  const roomIndex = activeBedOverlayRoomIndex.value
  if (roomIndex === null) return
  const room = rooms.value[roomIndex]
  if (!room || isBedConfigDisabled(room)) return

  const nextBeds = [
    ...(room.beds ?? []),
    createDefaultBedDraft(),
  ] as BedDraftExtended[]

  setBeds(roomIndex, nextBeds)
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeRoomType(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized) return roomTypeOptions[0]?.value ?? 'bedroom'
  return normalized
}

function resolveBedType(value: unknown) {
  const normalized = normalizeText(value)
  if (knownBedTypes.has(normalized)) return normalized
  return CUSTOM_BED_TYPE
}

function isNonSleepingRoomType(type: unknown) {
  return NON_SLEEPING_ROOM_TYPES.has(normalizeRoomType(type))
}

function isOtherRoomType(type: unknown) {
  return normalizeRoomType(type) === OTHER_ROOM_TYPE
}

function isCustomBedType(type: unknown) {
  return resolveBedType(type) === CUSTOM_BED_TYPE
}

function isBedConfigDisabled(room?: RoomDraftExtended) {
  return isNonSleepingRoomType(room?.type)
}

function sanitizeBedQuantity(value: unknown): number {
  return clampInteger(value, roomsLimits.bedQuantityMin, roomsLimits.bedQuantityMax, roomsLimits.bedQuantityMin)
}

function sanitizeBedCapacity(value: unknown, fallback = customBedCapacityMin): number {
  return clampInteger(value, customBedCapacityMin, customBedCapacityMax, fallback)
}

function sanitizeBedIconKey(value: unknown): BedIconKey {
  const normalized = String(value ?? '').trim()
  if (Object.prototype.hasOwnProperty.call(bedIconComponents, normalized)) {
    return normalized as BedIconKey
  }
  return 'bed-single'
}

function sanitizeCustomBedIcon(value: unknown): BedIconKey {
  const normalized = sanitizeBedIconKey(value)
  if (customIconChoiceSet.has(normalized)) return normalized
  return defaultCustomIcon
}

function sanitizeBed(bed: BedDraftExtended): BedDraftExtended {
  const type = resolveBedType((bed as any)?.type)
  const quantity = sanitizeBedQuantity((bed as any)?.quantity)
  const defaultCapacity = bedTypeCapacities[type] ?? customBedCapacityMin
  const base: BedDraftExtended = {
    ...bed,
    type,
    quantity,
    capacity: type === CUSTOM_BED_TYPE
      ? sanitizeBedCapacity((bed as any)?.capacity, defaultCapacity)
      : defaultCapacity,
  }

  if (type === CUSTOM_BED_TYPE) {
    return {
      ...base,
      customName: normalizeTextInput(String((bed as any)?.customName ?? ''), customBedNameMaxLength).trim()
        || customBedContent.fallbackName,
      customIcon: sanitizeCustomBedIcon((bed as any)?.customIcon),
    }
  }

  const {
    customName: _customName,
    customIcon: _customIcon,
    ...sanitizedWithoutCustom
  } = base

  return sanitizedWithoutCustom as BedDraftExtended
}

function getBedIconComponent(iconKey: unknown) {
  return bedIconComponents[sanitizeBedIconKey(iconKey)]
}

function roomLabel(room: RoomDraftExtended, index: number) {
  const label = String(room['room-name'] ?? '').trim()
  return label || roomTypeLabels[room.type ?? ''] || panelContent.roomLabelFallback.replace('{index}', String(index + 1))
}

function roomDisplayLabel(index: number) {
  return roomDisplayLabels.value[index] ?? panelContent.roomLabelFallback.replace('{index}', String(index + 1))
}

function roomCustomName(room: RoomDraftExtended) {
  return normalizeTextInput(String(room['room-name'] ?? ''), roomNameMaxLength).trim()
}

function roomBeds(room: RoomDraftExtended) {
  return (room.beds ?? []) as BedDraftExtended[]
}

function bedDisplayName(bed: BedDraftExtended) {
  if (isCustomBedType(bed.type)) {
    return normalizeTextInput(String((bed as any)?.customName ?? ''), customBedNameMaxLength).trim() || customBedContent.fallbackName
  }

  return bedTypeLabels[resolveBedType(bed.type)] ?? customBedContent.fallbackName
}

function bedDisplayIcon(bed: BedDraftExtended): BedIconKey {
  if (isCustomBedType(bed.type)) {
    return sanitizeCustomBedIcon((bed as any)?.customIcon)
  }

  const type = resolveBedType(bed.type)
  return bedTypeIcons[type] ?? fallbackBedIconByType[type] ?? 'bed-single'
}

function buildBedSummary(room: RoomDraftExtended) {
  const grouped = new Map<string, { key: string; quantity: number; label: string; iconKey: BedIconKey }>()

  roomBeds(room).forEach((rawBed) => {
    const bed = sanitizeBed(rawBed)
    const label = bedDisplayName(bed)
    const iconKey = bedDisplayIcon(bed)
    const key = `${resolveBedType(bed.type)}-${label}-${iconKey}`

    const existing = grouped.get(key)
    if (existing) {
      existing.quantity += sanitizeBedQuantity(bed.quantity)
      return
    }

    grouped.set(key, {
      key,
      quantity: sanitizeBedQuantity(bed.quantity),
      label,
      iconKey,
    })
  })

  return Array.from(grouped.values())
}

function bedSummaryText(summary: { quantity: number; label: string }) {
  return `${summary.quantity} ${formatBedLabel(summary.label, summary.quantity)}`
}

function formatBedLabel(label: string, quantity: number) {
  const normalized = label.trim().toLowerCase()
  if (quantity <= 1) return normalized

  if (normalized.startsWith('lit ')) {
    const suffix = normalized.slice(4)
    const pluralSuffix = suffix.endsWith('s') ? suffix : `${suffix}s`
    return `lits ${pluralSuffix}`
  }

  if (normalized.startsWith('canapé-lit')) {
    return 'canapé-lits'
  }

  return normalized.endsWith('s') ? normalized : `${normalized}s`
}

function incrementBedQuantity(roomIndex: number, bedIndex: number) {
  const bed = rooms.value[roomIndex]?.beds?.[bedIndex] as BedDraftExtended | undefined
  if (!bed) return
  updateBed(roomIndex, bedIndex, {
    quantity: sanitizeBedQuantity(bed.quantity) + 1,
  })
}

function decrementBedQuantity(roomIndex: number, bedIndex: number) {
  const bed = rooms.value[roomIndex]?.beds?.[bedIndex] as BedDraftExtended | undefined
  if (!bed) return
  updateBed(roomIndex, bedIndex, {
    quantity: sanitizeBedQuantity(bed.quantity) - 1,
  })
}

function updateBedQuantityFromInput(roomIndex: number, bedIndex: number, value: number) {
  updateBed(roomIndex, bedIndex, {
    quantity: value,
  })
}

function incrementBedCapacity(roomIndex: number, bedIndex: number) {
  const bed = rooms.value[roomIndex]?.beds?.[bedIndex] as BedDraftExtended | undefined
  if (!bed) return
  updateBed(roomIndex, bedIndex, {
    capacity: sanitizeBedCapacity((bed as any)?.capacity, customBedCapacityMin) + 1,
  })
}

function decrementBedCapacity(roomIndex: number, bedIndex: number) {
  const bed = rooms.value[roomIndex]?.beds?.[bedIndex] as BedDraftExtended | undefined
  if (!bed) return
  updateBed(roomIndex, bedIndex, {
    capacity: sanitizeBedCapacity((bed as any)?.capacity, customBedCapacityMin) - 1,
  })
}

function createDefaultBedDraft(): BedDraftExtended {
  const defaultType = resolveBedType(bedTypeOptions[0]?.value ?? 'simple')

  if (defaultType === CUSTOM_BED_TYPE) {
    return sanitizeBed({
      type: CUSTOM_BED_TYPE,
      quantity: roomsLimits.bedQuantityMin,
      capacity: customBedCapacityMin,
      customName: customBedContent.fallbackName,
      customIcon: defaultCustomIcon,
    } as BedDraftExtended)
  }

  return sanitizeBed({
    type: defaultType,
    quantity: roomsLimits.bedQuantityMin,
    capacity: bedTypeCapacities[defaultType] ?? customBedCapacityMin,
  } as BedDraftExtended)
}
</script>

<template>
  <section class="editor-rooms-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body rooms">
      <div class="rooms-list">
        <article
          v-for="(room, roomIndex) in rooms"
          :key="roomIndex"
          class="room-card"
        >
          <div class="room-card-top">
            <div class="room-config">
              <div class="input select room-select">
                <select
                  :value="normalizeRoomType(room.type)"
                  @change="setRoomType(roomIndex, ($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="option in roomTypeOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>

              <div class="room-actions">
                <div class="room-remove">
                  <button
                    type="button"
                    aria-label="Supprimer la pièce"
                    @click="removeRoom(roomIndex)" title="Supprimer la pièce"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="isOtherRoomType(room.type)"
              class="input field room-custom-name"
            >
              <input
                type="text"
                :maxlength="roomNameMaxLength"
                :value="roomCustomName(room)"
                :placeholder="panelContent.roomCustomNamePlaceholder"
                autocomplete="off"
                @input="setCustomRoomName(roomIndex, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <div class="room-summary">
            <ul v-if="!isBedConfigDisabled(room) && (roomBedSummaries[roomIndex]?.length ?? 0)">
              <li
                v-for="summary in roomBedSummaries[roomIndex] ?? []"
                :key="summary.key"
              >
                <component
                  :is="getBedIconComponent(summary.iconKey)"
                  :size="17"
                  aria-hidden="true"
                />
                <span>{{ bedSummaryText(summary) }}</span>
              </li>
            </ul>

            <p
              v-else-if="isBedConfigDisabled(room)"
              class="room-summary-empty"
            >
              {{ panelContent.nonSleepingLabel }}
            </p>
            <p
              v-else
              class="room-summary-empty"
            >
              {{ panelContent.emptyBedsLabel }}
            </p>
          </div>

          <div
            v-if="!isBedConfigDisabled(room)"
            class="room-footer"
          >
            <div class="room-add-bed">
              <button
                type="button"
                @click="openBedOverlay(roomIndex)"
              >
                {{ panelContent.addBed }}
              </button>
            </div>
          </div>
        </article>
      </div>

      <div class="add-room">
        <button
          type="button"
          @click="addRoom"
        >
          {{ panelContent.addRoom }}
        </button>
      </div>
    </div>

    <AbsoluteOverlay
      class="rooms-bed-overlay"
      :open="isBedOverlayOpen"
      mode="centered"
      :aria-label="customBedContent.overlayAriaLabel"
      :aria-labelledby="bedOverlayTitleId"
      @close="closeBedOverlay"
    >
      <div
        v-if="activeOverlayRoom"
        class="rooms-bed-overlay-panel"
      >
        <div class="overlay-header">
          <h4 :id="bedOverlayTitleId">
            {{ roomDisplayLabel(activeOverlayRoomIndex) }}
          </h4>

          <div class="overlay-close">
            <button
              type="button"
              aria-label="Fermer"
              @click="closeBedOverlay" title="Fermer"
            >
              <X :size="18" />
            </button>
          </div>
        </div>

        <div class="overlay-body">
          <div class="overlay-beds">
            <p
              v-if="roomBeds(activeOverlayRoom).length === 0"
              class="overlay-empty"
            >
              {{ panelContent.emptyBedsLabel }}
            </p>

            <div
              v-for="(bed, bedIndex) in roomBeds(activeOverlayRoom)"
              :key="bedIndex"
              class="bed-row"
            >
              <div class="stepper qty">
                <div class="btn">
                  <button
                    type="button"
                    aria-label="Augmenter la quantité"
                    title="Augmenter la quantité"
                    :disabled="sanitizeBedQuantity(bed.quantity) >= roomsLimits.bedQuantityMax"
                    @click="incrementBedQuantity(activeOverlayRoomIndex, bedIndex)"
                  >
                    <Plus :size="18" />
                  </button>
                </div>

                <input
                  class="value"
                  type="number"
                  :min="roomsLimits.bedQuantityMin"
                  :max="roomsLimits.bedQuantityMax"
                  step="1"
                  inputmode="numeric"
                  :value="sanitizeBedQuantity(bed.quantity)"
                  @input="updateBedQuantityFromInput(activeOverlayRoomIndex, bedIndex, ($event.target as HTMLInputElement).valueAsNumber)"
                />

                <div class="btn">
                  <button
                    type="button"
                    aria-label="Diminuer la quantité"
                    :disabled="sanitizeBedQuantity(bed.quantity) <= roomsLimits.bedQuantityMin"
                    @click="decrementBedQuantity(activeOverlayRoomIndex, bedIndex)" title="Diminuer la quantité"
                  >
                    <Minus :size="18" />
                  </button>
                </div>
              </div>

              <div class="input select bed-select">
                <select
                  :value="resolveBedType(bed.type)"
                  @change="setBedType(activeOverlayRoomIndex, bedIndex, ($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="option in bedTypeOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>

              <div class="remove">
                <button
                  type="button"
                  aria-label="Supprimer le lit"
                  @click="removeBed(activeOverlayRoomIndex, bedIndex)" title="Supprimer le lit"
                >
                  <Trash2 :size="18" />
                </button>
              </div>

              <div
                v-if="isCustomBedType(bed.type)"
                class="bed-custom"
              >
                <p class="bed-custom-label">{{ customBedContent.nameLabel }}</p>
                <div class="input field bed-custom-name">
                  <input
                    type="text"
                    :maxlength="customBedNameMaxLength"
                    :placeholder="customBedContent.namePlaceholder"
                    :value="bed.customName ?? ''"
                    autocomplete="off"
                    @input="updateBed(activeOverlayRoomIndex, bedIndex, { customName: ($event.target as HTMLInputElement).value })"
                  />
                </div>

                <div class="custom-icons">
                  <p>{{ customBedContent.iconLabel }}</p>
                  <div class="custom-icons-grid">
                    <button
                      v-for="iconChoice in customIconChoices"
                      :key="iconChoice.value"
                      type="button"
                      :class="{ 'is-selected': sanitizeCustomBedIcon(bed.customIcon) === sanitizeCustomBedIcon(iconChoice.value) }"
                      :aria-label="iconChoice.label"
                      :title="iconChoice.label"
                      @click="updateBed(activeOverlayRoomIndex, bedIndex, { customIcon: iconChoice.value })"
                    >
                      <component
                        :is="getBedIconComponent(iconChoice.value)"
                        :size="16"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>

                <div class="custom-capacity">
                  <p>{{ customBedContent.capacityLabel }}</p>
                  <div class="stepper qty">
                    <div class="btn">
                      <button
                        type="button"
                        aria-label="Augmenter la capacité"
                        title="Augmenter la capacité"
                        :disabled="sanitizeBedCapacity(bed.capacity) >= customBedCapacityMax"
                        @click="incrementBedCapacity(activeOverlayRoomIndex, bedIndex)"
                      >
                        <Plus :size="18" />
                      </button>
                    </div>

                    <input
                      class="value"
                      type="number"
                      :min="customBedCapacityMin"
                      :max="customBedCapacityMax"
                      step="1"
                      inputmode="numeric"
                      :value="sanitizeBedCapacity(bed.capacity)"
                      @input="updateBed(activeOverlayRoomIndex, bedIndex, { capacity: ($event.target as HTMLInputElement).valueAsNumber })"
                    />

                    <div class="btn">
                      <button
                        type="button"
                        aria-label="Diminuer la capacité"
                        :disabled="sanitizeBedCapacity(bed.capacity) <= customBedCapacityMin"
                        @click="decrementBedCapacity(activeOverlayRoomIndex, bedIndex)" title="Diminuer la capacité"
                      >
                        <Minus :size="18" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="overlay-submit">
            <div class="overlay-submit-add">
              <button
                type="button"
                @click="addBedFromOverlay"
              >
                {{ panelContent.overlayAddTitle }}
              </button>
            </div>

            <div class="overlay-submit-done">
              <button
                type="button"
                @click="closeBedOverlay"
              >
                {{ overlayDoneButtonLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteOverlay>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/rooms-panel.scss';
</style>
