<!-- File: src/views/ListingView/components/ListingCore/components/HostProfile/HostProfile.vue -->

<script setup lang="ts">
// TYPES
import type { HostProfileModel } from '@/views/ListingView/types/listing'
import { computed } from 'vue'
import { formatICUMessage } from '@/utils/i18n'

interface StaticContent {
  seniority: string
}

const props = defineProps<{
  data: HostProfileModel
  staticContent: StaticContent
}>()

const seniorityText = computed(() => {
  if (!props.data.seniority) return ''
  const years = Math.round(props.data.seniority / 12)
  return formatICUMessage(props.staticContent.seniority, { years })
})
</script>

<template>
  <div class="hostprofile-listing__comp">
    <img
      :src="data.avatar"
      :alt="data.name"
    />
    <div>
      <h2 v-html="data.name" />
      <ul>
        <li v-html="data.status" />
        <li v-if="data.seniority > 1">
          <span>&nbsp;—&nbsp;</span>
          {{ seniorityText }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.hostprofile-listing__comp {
  padding: var(--spacing-sm);

  display: flex;
  gap: var(--spacing-md);

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
      margin-bottom: var(--spacing-xs) !important;
      font-weight: 500 !important;
      @include base-text($bigger: true);
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
