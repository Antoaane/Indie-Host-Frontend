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

// CONTENT
const props = defineProps<{
  data: RoomsModel // adapte si ton shape exact diffère
  staticContent: { bedType: Record<string, any> }
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
</script>

<template>
  <div class="rooms-listing__comp">
    <ul>
      <li v-for="room in data.rooms">
        <div v-if="room.beds">
          <div class="bed-icon__container">
            <div
              v-for="(bed, bIndex) in room.beds"
              :key="bIndex"
            >
              <component
                v-for="i in bed.quantity"
                :is="getBedIcon(bed.type)"
                class="bed-icon"
                aria-hidden="true"
              />
            </div>
          </div>

          <div>
            <ul>
              <li
                v-for="bed in room.beds"
                :key="bed.type"
              >
                {{ bed.quantity }} {{ bedLabel(bed) }}
              </li>
            </ul>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.rooms-listing__comp {
  & > ul {
    display: flex;
    flex-direction: column;
    gap: var(--gutter-spacing-md);

    & > li {
      padding: var(--gutter-spacing-md);

      flex-grow: 1;
      flex-basis: 50%;

      display: flex;
      gap: var(--gutter-spacing-md);

      border: solid 1px $quaternary;
      border-radius: borders.$rounded-lg;

      .lucide {
        margin-top: var(--gutter-spacing-xs);

        flex-shrink: 0;
        flex-basis: 2rem;
        height: 2rem;

        stroke: $secondary;

        * {
          stroke: $secondary;
        }
      }
    }
  }
}
</style>
