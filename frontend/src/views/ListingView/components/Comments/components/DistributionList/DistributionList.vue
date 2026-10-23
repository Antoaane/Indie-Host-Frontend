<!-- File: src/views/ListingView/components/Comments/components/DistributionList/DistributionList.vue -->

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
  <section class="distribution-list">
    <h3 v-html="title"></h3>
    <div class="body">
      <ul class="progress">
        <li
          v-for="(entry, e) in entries.slice().reverse()"
          :key="entry.rating"
        >
          <span class="stars">
            <span v-html="e + 1"></span>
            <span class="sr-only">{{ e + 1 > 1 ? 'étoiles' : 'étoile' }}</span>
            <Star
              :size="14"
              aria-hidden="true"
            />
          </span>
          <progress
            :value="entry.percentage"
            max="100"
            v-html="`${entry.percentage}%`"
          ></progress>
        </li>
      </ul>

      <ul class="counts">
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
@use '@/views/ListingView/components/Comments/components/DistributionList/distribution-list.scss';
</style>
