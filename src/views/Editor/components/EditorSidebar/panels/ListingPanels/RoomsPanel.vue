<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/RoomsPanel.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

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
  roomTypeOptions.map((option) => [option.value, option.label]),
) as Record<string, string>
const bedTypeCapacities = Object.fromEntries(
  bedTypeOptions.map((option) => [option.value, option.capacity]),
) as Record<string, number>

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
  emit('patch', { core: { rooms: next } })
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
  collapsedRooms.value = [...collapsedRooms.value, true]
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
  const next = [
    ...(rooms.value[roomIndex]?.beds ?? []),
  ] as BedDraft[]
  next.push({ type: 'simple', capacity: 1, quantity: 1 } as BedDraft)
  setBeds(roomIndex, next)
}

function updateBed(roomIndex: number, index: number, patch: Partial<BedDraft>) {
  const next = [
    ...(rooms.value[roomIndex]?.beds ?? []),
  ] as BedDraft[]
  next[index] = { ...next[index], ...patch }
  setBeds(roomIndex, next)
}

function removeBed(roomIndex: number, index: number) {
  const next = (rooms.value[roomIndex]?.beds ?? []).filter((_, idx) => idx !== index) as BedDraft[]
  setBeds(roomIndex, next)
}

function setRoomType(index: number, nextType: string) {
  const nextLabel = roomTypeLabels[nextType] ?? panelContent.roomLabelGeneric
  updateRoom(index, { type: nextType, 'room-name': nextLabel })
}

function setBedType(roomIndex: number, bedIndex: number, nextType: string) {
  const nextCapacity = bedTypeCapacities[nextType] ?? 1
  updateBed(roomIndex, bedIndex, { type: nextType, capacity: nextCapacity })
}

function isRoomCollapsed(index: number) {
  return collapsedRooms.value[index] ?? true
}

function toggleRoomCollapse(index: number, force?: boolean) {
  const next = [...collapsedRooms.value]
  const current = next[index] ?? true
  next[index] = typeof force === 'boolean' ? force : !current
  collapsedRooms.value = next
}

function roomLabel(room: RoomDraft, index: number) {
  const label = (room['room-name'] ?? '').trim()
  return label
    || roomTypeLabels[room.type ?? '']
    || panelContent.roomLabelFallback.replace('{index}', String(index + 1))
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
                    @click="removeRoom(roomIndex)"
                  >
                    🗑
                  </button>
                </div>
                <div class="room-toggle">
                  <button
                    type="button"
                    @click="toggleRoomCollapse(roomIndex, false)"
                  >
                    ✎
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="room-remove">
                <button
                  type="button"
                  @click="removeRoom(roomIndex)"
                >
                  ✕
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
                  @click="toggleRoomCollapse(roomIndex, true)"
                >
                  ▲
                </button>
              </div>
            </template>
          </div>

          <Transition name="room-collapse">
            <div
              v-if="!isRoomCollapsed(roomIndex)"
              class="room-body"
            >
              <div class="room-beds">
                <div
                  v-for="(bed, bedIndex) in room.beds ?? []"
                  :key="bedIndex"
                  class="bed-row"
                >
                  <div class="stepper qty">
                    <div class="btn">
                      <button
                        type="button"
                        @click="updateBed(roomIndex, bedIndex, { quantity: (bed.quantity ?? 0) + 1 })"
                      >
                        +
                      </button>
                    </div>
                    <input
                      class="value"
                      type="number"
                      min="0"
                      :value="bed.quantity ?? 0"
                      @input="updateBed(roomIndex, bedIndex, { quantity: Number(($event.target as HTMLInputElement).value) })"
                    />
                    <div class="btn">
                      <button
                        type="button"
                        @click="updateBed(roomIndex, bedIndex, { quantity: Math.max(0, (bed.quantity ?? 0) - 1) })"
                      >
                        −
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
                      @click="removeBed(roomIndex, bedIndex)"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              <div class="btn-primary__black__full room-add-bed">
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
