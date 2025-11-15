<!-- File: src/views/ListingView/components/ListintComments/components/DistributionList/DistributionList.vue -->

<script setup lang="ts">
import { formatICUMessage } from '@/utils/i18n'

const props = defineProps<{
  entries: Array<{ rating: number; count: number; percentage: number }>
  title: string
  ratingLabel: string
}>()

function labelFor(entry: { rating: number }) {
  return formatICUMessage(props.ratingLabel, { count: entry.rating })
}
</script>

<template>
  <section class="listint-comments__distribution">
    <h3>{{ title }}</h3>
    <ul>
      <li v-for="entry in entries" :key="entry.rating">
        <div>
          <span>{{ labelFor(entry) }}</span>
          <progress :value="entry.percentage" max="100">
            {{ entry.percentage }}%
          </progress>
        </div>
        <span>{{ entry.count }}</span>
      </li>
    </ul>
  </section>
</template>
