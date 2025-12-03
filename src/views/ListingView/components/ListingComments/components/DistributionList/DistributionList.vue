<!-- File: src/views/ListingView/components/ListingComments/components/DistributionList/DistributionList.vue -->

<script setup lang="ts">
import { formatICUMessage } from '@/utils/i18n'
import { Star } from 'lucide-vue-next'

const props = defineProps<{
  entries: Array<{ rating: number; count: number; percentage: number }>
  title: string
  ratingLabel: string
}>()

function labelFor(entry: { rating: number; count: number; percentage: number }) {
  console.log(`${props.entries.length ? '✅' : '❌'} [DistributionList.vue](labelFor) distribution:item rating=${entry.rating} count=${entry.count}`)
  return formatICUMessage(props.ratingLabel, { count: entry.rating })
}

console.log(`${props.entries.length ? '✅' : '❌'} [DistributionList.vue](setup) distribution:received entries=${props.entries.length}`)
</script>

<template>
  <section class="listing-comments__distribution">
    <h3 v-html="title"></h3>
    <div>
      <ul class="listing-comments__progress-list">
        <li
          v-for="(entry, e) in entries.slice().reverse()"
          :key="entry.rating"
        >
          <span class="stars">
            <span v-html="e + 1"></span>
            <Star :size="14" />
          </span>
          <progress
            :value="entry.percentage"
            max="100"
            v-html="`${entry.percentage}%`"
          ></progress>
        </li>
      </ul>

      <ul class="listing-comments__count-list">
        <li
          v-for="entry in entries.slice().reverse()"
          :key="entry.rating"
        >
          <span v-html="entry.count"></span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-comments__distribution {
  width: 100%;
  h3 {
    max-width: 16rem;
    @include h3-title($colorful: false);
  }

  div {
    max-width: 16rem;
    display: flex;
    gap: var(--gutter-spacing-md);

    ul {
      display: flex;
      flex-direction: column-reverse;
      justify-content: space-between;

      li {
        height: 100%;
        width: 100%;

        display: flex;
        align-items: center;
        gap: var(--gutter-spacing-sm);

        progress {
          width: 100%;
          height: 6px;
          appearance: none;
          -webkit-appearance: none;
          border: none;
          background: $quaternary; /* gris clair */
          border-radius: borders.$rounded;
          overflow: hidden;

          &::-webkit-progress-bar {
            background: $quaternary; /* fond gris */
          }

          &::-webkit-progress-value {
            background: $secondary; /* barre noire */
            transition: width 0.25s ease;
          }

          /* Firefox */
          &::-moz-progress-bar {
            background: $secondary; /* barre noire */
            transition: width 0.25s ease;
          }
        }

        span {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: var(--gutter-spacing-2xs);

          @include little-text($thin: false);

          .lucide-star-icon {
            fill: $secondary;
            stroke: $secondary;
          }
        }

        .stars {
          width: 30px;
        }
      }
    }

    .listing-comments__progress-list {
      flex: 1;
    }

    .listing-comments__count-list {
      width: max-content;
      @include little-text($thin: false);
    }
  }
}
</style>
