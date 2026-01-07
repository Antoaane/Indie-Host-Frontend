<!-- File: src/views/ListingView/components/Core/components/Rooms/Rooms.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import { BedDouble, BedSingle } from 'lucide-vue-next'
// UTILS
import { formatICUMessage } from '@/utils/i18n'
// TYPES
import type { RoomsModel, BedItem } from '@/views/ListingView/types/listing'

// type BedKind = 'simple' | 'double' | 'bunk'
// type BedItem = { type: string; quantity: number }
// type RoomItem = { beds: BedItem[] }

interface StaticContent {
  title: string
  bedType: Record<string, any>
}

// CONTENT
const props = defineProps<{
  data: RoomsModel // adapte si ton shape exact diffère
  staticContent: StaticContent
}>()

function getBedIcon(bedType: string) {
  if (bedType == 'double') {
    return BedDouble as Record<string, any>
  }

  if (bedType == 'simple') {
    return BedSingle as Record<string, any>
  }

  return null
}

function bedLabel(bed: BedItem) {
  return formatICUMessage(props.staticContent.bedType[bed.type], { count: bed.quantity })
}

function getRoomDisplayName(roomName: string, index: number) {
  const rooms = props.data.rooms

  // combien de rooms ont ce nom au total ?
  const totalForName = rooms.filter((room) => room.name === roomName).length

  // s'il n'y en a qu'une, on ne numérote pas
  if (totalForName <= 1) {
    return roomName
  }

  // sinon on calcule le rang de cette occurrence
  const occurrence = rooms.slice(0, index + 1).filter((room) => room.name === roomName).length

  return `${roomName} ${occurrence}`
}
</script>

<template>
  <section class="listing-rooms">
    <h2 v-html="staticContent.title" />
    <ul>
      <template
        v-for="(room, index) in data.rooms"
        :key="room.name + '-' + index"
      >
        <li v-if="room.beds">
          <div>
            <h3 v-html="getRoomDisplayName(room.name, index)" />
            <div class="icons">
              <template
                v-for="(bed, bIndex) in room.beds"
                :key="bIndex"
              >
                <component
                  v-for="i in bed.quantity"
                  :is="getBedIcon(bed.type)"
                  class="bed-icon"
                  aria-hidden="true"
                />
              </template>
            </div>
          </div>

          <div class="types">
            <ul>
              <li
                v-for="bed in room.beds"
                :key="bed.type"
                v-html="`${bed.quantity} ${bedLabel(bed)}`"
              />
            </ul>
          </div>
        </li>
      </template>
    </ul>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Core/components/Rooms/rooms.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-rooms {
  > h2 {
    margin-bottom: var(--layout-gap-md) !important;
    @include h2-title($gradiant: true);
  }

  > ul {
    display: grid;
    gap: var(--layout-gap-md);

    grid-template-columns: repeat(1, 1fr);

    @include min-width(md) {
      grid-template-columns: repeat(2, 1fr);
    }

    // @include min-width(lg) {
    //   grid-template-columns: repeat(2, 1fr);
    // }

    @include min-width(xl) {
      grid-template-columns: repeat(3, 1fr);
    }

    > li {
      padding: var(--layout-gap-md);

      flex-grow: 1;
      flex-basis: 50%;

      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-md);

      border: solid 1px $quaternary;
      border-radius: borders.$rounded-lg;

      > div {
        display: flex;
        justify-content: space-between;

        > h3 {
          @include base-text($bigger: true, $bold: true);
        }

        > .icons {
          margin-left: var(--layout-gap-sm);

          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: var(--layout-gap-xs);

          > .lucide {
            height: 1.5rem;
            width: max-content;

            stroke: $secondary;

            * {
              stroke: $secondary;
            }
          }
        }
      }
    }
  }
}
</style>
