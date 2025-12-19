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
  <section class="listing-host-profile">
    <img
      :src="data.avatar"
      :alt="data.name"
      class="avatar"
    />
    <div class="body">
      <h2
        class="name"
        v-html="data.name"
      />
      <ul class="meta">
        <li
          class="item"
          v-html="data.status"
        />
        <li
          v-if="data.seniority > 1"
          class="item"
        >
          <span>&nbsp;—&nbsp;</span>
          {{ seniorityText }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/ListingCore/components/HostProfile/host-profile.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-host-profile {
  padding: var(--layout-gap-sm);

  display: flex;
  gap: var(--layout-gap-md);

  border-radius: borders.$rounded-lg;
  background-color: $accent;

  @include big-shadow();

  > .avatar {
    width: 3.5rem;
    height: 3.5rem;
    object-fit: cover;

    border-radius: borders.$rounded;
  }

  > .body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;

    > .name {
      margin-bottom: var(--layout-gap-xs) !important;
      font-weight: 500 !important;
      @include base-text($bigger: true);
    }

    > .meta {
      display: flex;
      align-items: center;

      opacity: 0.65;

      > .item {
        display: inline-flex;
        @include little-text($thin: false);
      }
    }
  }
}
</style>
