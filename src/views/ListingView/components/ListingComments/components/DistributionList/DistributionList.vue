<!-- File: src/views/ListingView/components/ListingComments/components/DistributionList/DistributionList.vue -->

<script setup lang="ts">
import { formatICUMessage } from '@/utils/i18n'

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
    <h3>{{ title }}</h3>
    <ul>
      <li
        v-for="entry in entries"
        :key="entry.rating"
      >
        <div>
          <span>{{ labelFor(entry) }}</span>
          <progress
            :value="entry.percentage"
            max="100"
          >
            {{ entry.percentage }}%
          </progress>
        </div>
        <span>{{ entry.count }}</span>
      </li>
    </ul>
  </section>
</template>
