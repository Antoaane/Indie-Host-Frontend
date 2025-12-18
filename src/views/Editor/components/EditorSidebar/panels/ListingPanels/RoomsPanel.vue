<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/RoomsPanel.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

type RoomDraft = NonNullable<RawCore['rooms']>[number]
type BedDraft = NonNullable<NonNullable<RoomDraft['beds']>[number]>

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const rooms = computed<RoomDraft[]>(() => (props.core?.rooms as RoomDraft[] | undefined) ?? [])
const selectedIndex = ref(0)

watch(
  () => rooms.value.length,
  (len) => {
    if (!len) {
      selectedIndex.value = 0
      return
    }
    if (selectedIndex.value > len - 1) selectedIndex.value = len - 1
  },
)

const selectedRoom = computed<RoomDraft | null>(() => rooms.value[selectedIndex.value] ?? null)

function setRooms(next: RoomDraft[]) {
  emit('patch', { core: { rooms: next } })
}

function addRoom() {
  const next = [
    ...rooms.value,
  ]
  next.push({
    'room-name': 'Chambre',
    type: 'bedroom',
    beds: [],
  } as RoomDraft)
  setRooms(next)
  selectedIndex.value = next.length - 1
}

function removeRoom(index: number) {
  const next = rooms.value.filter((_, idx) => idx !== index)
  setRooms(next)
  selectedIndex.value = Math.max(0, selectedIndex.value - 1)
}

function updateRoom(patch: Partial<RoomDraft>) {
  if (!selectedRoom.value) return
  const next = [
    ...rooms.value,
  ]
  next[selectedIndex.value] = { ...next[selectedIndex.value], ...patch }
  setRooms(next)
}

function setBeds(nextBeds: BedDraft[]) {
  if (!selectedRoom.value) return
  const next = [
    ...rooms.value,
  ]
  next[selectedIndex.value] = {
    ...next[selectedIndex.value],
    beds: nextBeds,
  }
  setRooms(next)
}

function addBed() {
  const next = [
    ...(selectedRoom.value?.beds ?? []),
  ] as BedDraft[]
  next.push({ type: 'simple', capacity: 1, quantity: 1 } as BedDraft)
  setBeds(next)
}

function updateBed(index: number, patch: Partial<BedDraft>) {
  const next = [
    ...(selectedRoom.value?.beds ?? []),
  ] as BedDraft[]
  next[index] = { ...next[index], ...patch }
  setBeds(next)
}

function removeBed(index: number) {
  const next = (selectedRoom.value?.beds ?? []).filter((_, idx) => idx !== index) as BedDraft[]
  setBeds(next)
}
</script>

<template>
  <section class="editor-rooms-panel">
    <div class="header">
      <h3>Couchages</h3>
      <p>Indiquez le nombre de couchage par pièce</p>
    </div>

    <div class="body rooms">
      <div class="row">
        <select
          class="input select"
          :value="selectedIndex"
          :disabled="!rooms.length"
          @change="selectedIndex = Number(($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="(room, idx) in rooms"
            :key="idx"
            :value="idx"
          >
            {{ room['room-name'] || `Pièce ${idx + 1}` }}
          </option>
        </select>
        <div
          class="trash"
        >
          <button
            type="button"
            :disabled="!rooms.length"
            @click="removeRoom(selectedIndex)"
          >
            🗑
          </button>
        </div>
      </div>

      <div
        v-if="selectedRoom"
        class="details"
      >
        <div class="row">
          <input
            class="input"
            :value="selectedRoom['room-name']"
            type="text"
            placeholder="Nom de la pièce"
            @input="updateRoom({ 'room-name': ($event.target as HTMLInputElement).value } as any)"
          />
          <select
            class="input"
            :value="selectedRoom.type"
            @change="updateRoom({ type: ($event.target as HTMLSelectElement).value } as any)"
          >
            <option value="bedroom"> Chambre </option>
            <option value="livingroom"> Salon </option>
            <option value="bathroom"> Salle de bain </option>
            <option value="kitchen"> Cuisine </option>
            <option value="other"> Autre </option>
          </select>
        </div>

        <div class="beds">
          <div
            v-for="(bed, idx) in selectedRoom.beds ?? []"
            :key="idx"
            class="row"
          >
            <select
              class="input"
              :value="bed.type"
              @change="updateBed(idx, { type: ($event.target as HTMLSelectElement).value } as any)"
            >
              <option value="simple"> Lit simple </option>
              <option value="double"> Lit double </option>
              <option value="bunk"> Lit superposés </option>
            </select>
            <input
              class="input cap"
              type="number"
              min="0"
              :value="bed.capacity"
              @input="updateBed(idx, { capacity: Number(($event.target as HTMLInputElement).value) } as any)"
            />
            <div class="stepper qty">
              <div
                class="btn"
              >
                <button
                  type="button"
                  @click="updateBed(idx, { quantity: Math.max(0, (bed.quantity ?? 0) - 1) } as any)"
                >
                  −
                </button>
              </div>
              <input
                class="value"
                type="number"
                min="0"
                :value="bed.quantity ?? 0"
                @input="updateBed(idx, { quantity: Number(($event.target as HTMLInputElement).value) } as any)"
              />
              <div
                class="btn"
              >
                <button
                  type="button"
                  @click="updateBed(idx, { quantity: (bed.quantity ?? 0) + 1 } as any)"
                >
                  +
                </button>
              </div>
            </div>
            <div
              class="remove"
            >
              <button
                type="button"
                @click="removeBed(idx)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div class="btn-primary__black__full">
          <button
            type="button"
            @click="addBed"
          >
            + Ajouter un lit
          </button>
        </div>
      </div>

      <div class="btn-primary__white__full">
        <button
          type="button"
          @click="addRoom"
        >
          + Ajouter une pièce
        </button>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/rooms-panel.scss';
</style>
