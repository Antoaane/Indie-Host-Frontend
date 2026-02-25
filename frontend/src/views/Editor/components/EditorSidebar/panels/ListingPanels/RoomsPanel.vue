<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/RoomsPanel.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronUp, Minus, Pencil, Plus, Trash2, X } from 'lucide-vue-next'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, normalizeTextInput, resolveTextMaxLength } from '@/utils/inputValidation'

type RoomDraft = NonNullable<RawCore['rooms']>[number]
type BedDraft = NonNullable<NonNullable<RoomDraft['beds']>[number]>

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const rooms = computed<RoomDraft[]>(() => (props.core?.rooms as RoomDraft[] | undefined) ?? [])

const panelContent = editorStatic.panels.listing.rooms
const roomTypeOptions = panelContent.types
const bedTypeOptions = panelContent.bedTypes

const roomTypeLabels = Object.fromEntries(
  roomTypeOptions.map((option) => [
    option.value,
    option.label,
  ]),
) as Record<string, string>
const bedTypeCapacities = Object.fromEntries(
  bedTypeOptions.map((option) => [
    option.value,
    option.capacity,
  ]),
) as Record<string, number>
const NON_SLEEPING_ROOM_TYPES = new Set([
  'kitchen',
  'bathroom',
])
const OTHER_ROOM_TYPE = 'other'
const roomsLimits = editorStatic.validation.listing.rooms
const textDefaults = editorStatic.validation.defaults.simpleText
const roomNameMaxLength = resolveTextMaxLength(roomsLimits.roomNameMax, textDefaults)

const collapsedRooms = ref<boolean[]>([])

watch(
  () => rooms.value.length,
  (len) => {
    if (collapsedRooms.value.length < len) {
      collapsedRooms.value = [
        ...collapsedRooms.value,
        ...Array(len - collapsedRooms.value.length).fill(true),
      ]
      return
    }
    if (collapsedRooms.value.length > len) {
      collapsedRooms.value = collapsedRooms.value.slice(0, len)
    }
  },
  { immediate: true },
)

function setRooms(next: RoomDraft[]) {
  const sanitized = next.map((room) => {
    const roomName = normalizeTextInput(String(room['room-name'] ?? ''), roomNameMaxLength).trim()
    const baseRoom = {
      ...room,
      'room-name': roomName || panelContent.roomLabelGeneric,
    } as RoomDraft

    if (!isNonSleepingRoomType(baseRoom.type) && Array.isArray(baseRoom.beds)) {
      return {
        ...baseRoom,
        beds: baseRoom.beds.map((bed) => ({
          ...bed,
          quantity: sanitizeBedQuantity((bed as any)?.quantity),
        })),
      } as RoomDraft
    }

    if (!Array.isArray(baseRoom.beds) || baseRoom.beds.length === 0) return baseRoom
    return {
      ...baseRoom,
      beds: [],
    } as RoomDraft
  })
  emit('patch', { core: { rooms: sanitized } })
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
  } as RoomDraft)
  setRooms(next)
  collapsedRooms.value = [
    ...collapsedRooms.value,
    true,
  ]
}

function removeRoom(index: number) {
  const next = rooms.value.filter((_, idx) => idx !== index)
  setRooms(next)
  collapsedRooms.value = collapsedRooms.value.filter((_, idx) => idx !== index)
}

function updateRoom(index: number, patch: Partial<RoomDraft>) {
  const next = [
    ...rooms.value,
  ]
  if (!next[index]) return
  next[index] = { ...next[index], ...patch }
  setRooms(next)
}

function setBeds(index: number, nextBeds: BedDraft[]) {
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

function addBed(roomIndex: number) {
  if (isBedConfigDisabled(rooms.value[roomIndex])) return
  const next = [
    ...(rooms.value[roomIndex]?.beds ?? []),
  ] as BedDraft[]
  next.push({ type: 'simple', capacity: 1, quantity: 1 } as BedDraft)
  setBeds(roomIndex, next)
}

function updateBed(roomIndex: number, index: number, patch: Partial<BedDraft>) {
  if (isBedConfigDisabled(rooms.value[roomIndex])) return
  const next = [
    ...(rooms.value[roomIndex]?.beds ?? []),
  ] as BedDraft[]
  if (!next[index]) return

  const nextPatch = {
    ...patch,
    ...(Object.prototype.hasOwnProperty.call(patch, 'quantity')
      ? { quantity: sanitizeBedQuantity(patch.quantity) }
      : {}),
  }
  next[index] = { ...next[index], ...nextPatch }
  setBeds(roomIndex, next)
}

function removeBed(roomIndex: number, index: number) {
  if (isBedConfigDisabled(rooms.value[roomIndex])) return
  const next = (rooms.value[roomIndex]?.beds ?? []).filter((_, idx) => idx !== index) as BedDraft[]
  setBeds(roomIndex, next)
}

function setRoomType(index: number, nextType: string) {
  const room = rooms.value[index]
  if (!room) return

  const nextLabel = roomTypeLabels[nextType] ?? panelContent.roomLabelGeneric
  const patch: Partial<RoomDraft> = {
    type: nextType,
    'room-name': nextLabel,
  }

  if (isOtherRoomType(nextType)) {
    const currentCustomName = isOtherRoomType(room.type)
      ? String(room['room-name'] ?? '').trim()
      : ''
    patch['room-name'] = promptCustomRoomName(currentCustomName)
  }

  if (isNonSleepingRoomType(nextType)) {
    patch.beds = []
  }

  updateRoom(index, patch)
}

function setBedType(roomIndex: number, bedIndex: number, nextType: string) {
  if (isBedConfigDisabled(rooms.value[roomIndex])) return
  const nextCapacity = bedTypeCapacities[nextType] ?? 1
  updateBed(roomIndex, bedIndex, { type: nextType, capacity: nextCapacity })
}

function normalizeRoomType(type: unknown) {
  return String(type ?? '').trim().toLowerCase()
}

function isNonSleepingRoomType(type: unknown) {
  return NON_SLEEPING_ROOM_TYPES.has(normalizeRoomType(type))
}

function isOtherRoomType(type: unknown) {
  return normalizeRoomType(type) === OTHER_ROOM_TYPE
}

function isBedConfigDisabled(room?: RoomDraft) {
  return isNonSleepingRoomType(room?.type)
}

function promptCustomRoomName(currentValue: string) {
  const fallbackLabel = roomTypeLabels[OTHER_ROOM_TYPE] ?? panelContent.roomLabelGeneric
  if (typeof window === 'undefined') return currentValue || fallbackLabel

  const response = window.prompt('Nom personnalisé de la pièce', currentValue)
  const nextValue = normalizeTextInput((response ?? '').trim(), roomNameMaxLength)
  return nextValue || currentValue || fallbackLabel
}

function sanitizeBedQuantity(value: unknown): number {
  return clampInteger(value, roomsLimits.bedQuantityMin, roomsLimits.bedQuantityMax, roomsLimits.bedQuantityMin)
}

function editRoom(index: number) {
  const room = rooms.value[index]
  if (!room) return

  if (isOtherRoomType(room.type)) {
    const currentName = String(room['room-name'] ?? '').trim()
    const nextName = promptCustomRoomName(currentName)
    if (nextName !== currentName) {
      updateRoom(index, { 'room-name': nextName })
    }
  }

  toggleRoomCollapse(index, false)
}

function isRoomCollapsed(index: number) {
  return collapsedRooms.value[index] ?? true
}

function toggleRoomCollapse(index: number, force?: boolean) {
  const next = [
    ...collapsedRooms.value,
  ]
  const current = next[index] ?? true
  next[index] = typeof force === 'boolean' ? force : !current
  collapsedRooms.value = next
}

function roomLabel(room: RoomDraft, index: number) {
  const label = (room['room-name'] ?? '').trim()
  return label || roomTypeLabels[room.type ?? ''] || panelContent.roomLabelFallback.replace('{index}', String(index + 1))
}

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
</script>

<template>
  <section class="editor-rooms-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body rooms">
      <div class="rooms-list">
        <div
          v-for="(room, roomIndex) in rooms"
          :key="roomIndex"
          class="room-card"
          :class="{ 'is-collapsed': isRoomCollapsed(roomIndex) }"
        >
          <div
            class="room-header"
            :class="{ 'is-collapsed': isRoomCollapsed(roomIndex) }"
          >
            <template v-if="isRoomCollapsed(roomIndex)">
              <p class="room-name">
                {{ roomLabel(room, roomIndex) }}
              </p>
              <div class="room-actions">
                <div class="room-remove">
                  <button
                    type="button"
                    aria-label="Supprimer la pièce"
                    @click="removeRoom(roomIndex)"
                  >
                    <Trash2 :size="20" />
                  </button>
                </div>
                <div class="room-toggle">
                  <button
                    type="button"
                    aria-label="Modifier la pièce"
                    @click="editRoom(roomIndex)"
                  >
                    <Pencil :size="20" />
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="room-remove">
                <button
                  type="button"
                  aria-label="Supprimer la pièce"
                  @click="removeRoom(roomIndex)"
                >
                  <X :size="20" />
                </button>
              </div>
              <div class="input select room-select">
                <select
                  :value="room.type || 'other'"
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
              <div class="room-toggle">
                <button
                  type="button"
                  aria-label="Replier la pièce"
                  @click="toggleRoomCollapse(roomIndex, true)"
                >
                  <ChevronUp :size="20" />
                </button>
              </div>
            </template>
          </div>

          <Transition name="room-collapse">
            <div
              v-if="!isRoomCollapsed(roomIndex)"
              class="room-body"
            >
              <div
                v-if="!isBedConfigDisabled(room)"
                class="room-beds"
              >
                <div
                  v-for="(bed, bedIndex) in room.beds ?? []"
                  :key="bedIndex"
                  class="bed-row"
                >
                  <div class="stepper qty">
                    <div class="btn">
                      <button
                        type="button"
                        aria-label="Augmenter la quantité"
                        :disabled="sanitizeBedQuantity(bed.quantity) >= roomsLimits.bedQuantityMax"
                        @click="updateBed(roomIndex, bedIndex, { quantity: sanitizeBedQuantity(bed.quantity) + 1 })"
                      >
                        <Plus :size="20" />
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
                      @input="updateBed(roomIndex, bedIndex, { quantity: ($event.target as HTMLInputElement).valueAsNumber })"
                    />
                    <div class="btn">
                      <button
                        type="button"
                        aria-label="Diminuer la quantité"
                        :disabled="sanitizeBedQuantity(bed.quantity) <= roomsLimits.bedQuantityMin"
                        @click="updateBed(roomIndex, bedIndex, { quantity: sanitizeBedQuantity(bed.quantity) - 1 })"
                      >
                        <Minus :size="20" />
                      </button>
                    </div>
                  </div>

                  <div class="input select">
                    <select
                      :value="bed.type"
                      @change="setBedType(roomIndex, bedIndex, ($event.target as HTMLSelectElement).value)"
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
                      @click="removeBed(roomIndex, bedIndex)"
                    >
                      <X :size="20" />
                    </button>
                  </div>
                </div>
              </div>

              <div
                v-if="!isBedConfigDisabled(room)"
                class="btn-primary__black__full room-add-bed"
              >
                <button
                  type="button"
                  @click="addBed(roomIndex)"
                >
                  {{ panelContent.addBed }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <div class="btn-primary__white__full">
        <button
          type="button"
          @click="addRoom"
        >
          {{ panelContent.addRoom }}
        </button>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/rooms-panel.scss';
</style>
