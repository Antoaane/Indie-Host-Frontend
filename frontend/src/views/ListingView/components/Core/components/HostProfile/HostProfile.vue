<!-- File: src/views/ListingView/components/Core/components/HostProfile/HostProfile.vue -->

<script setup lang="ts">
// TYPES
import type { HostProfileModel } from '@/views/ListingView/types/listing'
import { computed } from 'vue'
import { User } from 'lucide-vue-next'
import { formatICUMessage } from '@/utils/i18n'
import { sanitizeHtml } from '@/utils/sanitizeHtml'

const FALLBACK_HOST_NAME = 'Votre hôte'
// Valeurs techniques renvoyées par l'API → libellé français ; tout autre texte est affiché tel quel.
const STATUS_LABELS: Record<string, string> = {
  host: 'Hôte',
}
// Qualité du loueur déclarée par l'hôte (art. L111-7 Code de la consommation) : prime sur le statut générique.
const LEGAL_STATUS_LABELS: Record<NonNullable<HostProfileModel['legalStatus']>, string> = {
  individual: 'Hôte particulier',
  professional: 'Hôte professionnel',
}

interface StaticContent {
  seniority: string
}

const props = defineProps<{
  data: HostProfileModel
  staticContent: StaticContent
}>()

const hostName = computed(() => props.data.name?.trim() || FALLBACK_HOST_NAME)
const avatarSrc = computed(() => props.data.avatar?.trim() || '')

const statusLabel = computed(() => {
  const legalStatus = props.data.legalStatus
  if (legalStatus && LEGAL_STATUS_LABELS[legalStatus]) {
    const companyName = legalStatus === 'professional' ? props.data.companyName?.trim() : ''
    return companyName ? `${LEGAL_STATUS_LABELS[legalStatus]} · ${companyName}` : LEGAL_STATUS_LABELS[legalStatus]
  }
  const status = props.data.status?.trim()
  if (!status) return ''
  return STATUS_LABELS[status.toLowerCase()] ?? status
})

const seniorityText = computed(() => {
  if (!props.data.seniority) return ''
  const years = Math.round(props.data.seniority / 12)
  return formatICUMessage(props.staticContent.seniority, { years })
})
</script>

<template>
  <section class="listing-host-profile">
    <img
      v-if="avatarSrc"
      :src="avatarSrc"
      :alt="hostName"
      class="avatar"
    />
    <span
      v-else
      class="avatar avatar--placeholder"
      aria-hidden="true"
    >
      <User :size="24" />
    </span>
    <div class="body">
      <h2
        class="name"
        v-html="sanitizeHtml(hostName)"
      />
      <ul
        v-if="statusLabel || data.seniority > 1"
        class="meta"
      >
        <li
          v-if="statusLabel"
          class="item"
          v-html="sanitizeHtml(statusLabel)"
        />
        <li
          v-if="data.seniority > 1"
          class="item"
        >
          <span v-if="statusLabel">&nbsp;—&nbsp;</span>
          {{ seniorityText }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Core/components/HostProfile/host-profile.scss */

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
    flex: 0 0 auto;
    width: 3.5rem;
    height: 3.5rem;
    object-fit: cover;

    border-radius: borders.$rounded;

    &--placeholder {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: rgba($secondary, 0.65);
      background-color: $accent-surface-2;
    }
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
