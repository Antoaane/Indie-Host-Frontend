<!-- File: src/views/ListingView/components/ListingCore/components/HostProfile/HostProfile.vue -->

<script setup lang="ts">
// TYPES
import type { HostProfileModel } from '@/views/ListingView/types/listing'
// CONTENT
import listing from '@/content/fr/_Static/lisitng.json'

const props = defineProps<{
  host: HostProfileModel
}>()

const content = listing.items

function monthsToYears(months: number): number {
  const years = Math.round(months / 12)
  return years
}
</script>

<template>
  <div class="hostprofile-listing-comp">
    <img
      :src="host.avatar"
      :alt="host.name"
    />
    <div>
      <h2>
        {{ host.name }}
      </h2>
      <ul>
        <li>
          {{ host.status }}
        </li>
        <li v-if="host.seniority > 1">
          <span>&nbsp;—&nbsp;</span>
          {{ content['profile-seniority-text-1'].content }}
          {{ monthsToYears(host.seniority) }}
          {{ content['profile-seniority-text-2'].content }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.hostprofile-listing-comp {
  padding: var(--gutter-spacing-sm);

  display: flex;
  gap: var(--gutter-spacing-md);

  border-radius: borders.$rounded-lg;
  background-color: $accent;

  @include big-shadow();

  img {
    width: 3.5rem;
    height: 3.5rem;
    object-fit: cover;

    border-radius: borders.$rounded;
  }

  div {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;

    h2 {
      margin-bottom: var(--gutter-spacing-xs) !important;
      font-weight: 500 !important;
      @include base-text;
    }

    ul {
      display: flex;
      align-items: center;

      opacity: 0.65;

      li {
        display: inline-flex;
        @include little-text($thin: false);
      }
    }
  }
}
</style>
