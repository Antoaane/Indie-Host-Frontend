<!-- File: src/views/ListingView/components/ListingCore/components/Rooms/Rooms.vue -->

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
  <div class="rooms-listing__comp">
    <h2 v-html="staticContent.title" />
    <ul>
      <template
        v-for="(room, index) in data.rooms"
        :key="room.name + '-' + index"
      >
        <li v-if="room.beds">
          <div>
            <h3 v-html="getRoomDisplayName(room.name, index)" />
            <div class="bed-icon__container">
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

          <div class="bed-type__container">
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
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.rooms-listing__comp {
  h2 {
    margin-bottom: var(--gutter-spacing-md) !important;
    @include h2-title($gradiant: true);
  }

  & > ul {
    display: grid;
    gap: var(--gutter-spacing-md);

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

    & > li {
      padding: var(--gutter-spacing-md);

      flex-grow: 1;
      flex-basis: 50%;

      display: flex;
      flex-direction: column;
      gap: var(--gutter-spacing-md);

      border: solid 1px $quaternary;
      border-radius: borders.$rounded-lg;

      & > div {
        display: flex;
        justify-content: space-between;

        h3 {
          @include base-text($bigger: true, $thin: false);
        }

        .bed-icon__container {
          margin-left: var(--gutter-spacing-sm);

          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: var(--gutter-spacing-xs);

          .lucide {
            height: 1.5rem;
            width: max-content;

            stroke: $secondary;

            * {
              stroke: $secondary;
            }
          }
        }

        .bed-type__container {
          display: flex;
          flex-direction: column;
        }
      }
    }
  }
}
</style>
