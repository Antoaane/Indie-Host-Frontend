<!-- File: src/views/Admin/components/UptimeStrip.vue -->

<!-- Les dernières 24 h d'un service, par demi-heure : une barre par tranche, colorée par le pire
     état mesuré dans la tranche (gris : pas de mesure, l'API venait peut-être de redémarrer).
     Le détail de chaque barre est dans son info-bulle ; le résumé lisible est au-dessus. -->

<script setup lang="ts">
import { computed } from 'vue'

import type { HealthBucket } from '@/domain/api/admin'
import { SERVICE_STATUS, formatTime } from '@/views/Admin/adminFormat'

const props = defineProps<{
  history: HealthBucket[]
  label: string
}>()

function bucketTone(bucket: HealthBucket): string {
  if (bucket.status === 'none') return 'is-none'
  return `is-${SERVICE_STATUS[bucket.status].tone}`
}

function bucketTitle(bucket: HealthBucket): string {
  const start = formatTime(bucket.startISO)
  const end = formatTime(new Date(Date.parse(bucket.startISO) + 30 * 60 * 1000).toISOString())
  if (bucket.status === 'none') return `${start} – ${end} : pas de mesure`
  const latency = bucket.avgLatencyMs !== null ? ` · ${bucket.avgLatencyMs} ms en moyenne` : ''
  return `${start} – ${end} : ${SERVICE_STATUS[bucket.status].label.toLowerCase()}${latency}`
}

const firstLabel = computed(() => formatTime(props.history[0]?.startISO ?? null))
</script>

<template>
  <figure class="admin-uptime-strip">
    <div
      class="bars"
      role="img"
      :aria-label="label"
    >
      <span
        v-for="bucket in history"
        :key="bucket.startISO"
        class="bar"
        :class="bucketTone(bucket)"
        :title="bucketTitle(bucket)"
      />
    </div>
    <figcaption class="axis">
      <span>{{ firstLabel }}</span>
      <span>maintenant</span>
    </figcaption>
  </figure>
</template>

<style lang="scss">
/* File: src/views/Admin/components/UptimeStrip.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.admin-uptime-strip {
  margin: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-2xs);

  > .bars {
    height: 1.75rem;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    // Un mince écart entre les barres : la surface les sépare, pas un trait.
    gap: var(--layout-gap-2xs);

    > .bar {
      min-width: 0;
      border-radius: borders.$rounded-xs;
      background: rgba($secondary, 0.08);

      &.is-good {
        background: $good-ink;
      }

      &.is-warn {
        background: $warn-ink;
      }

      &.is-bad {
        background: $bad-ink;
      }

      &.is-muted {
        background: rgba($secondary, 0.18);
      }
    }
  }

  > .axis {
    display: flex;
    justify-content: space-between;
    @include little-text(rgba($secondary-text, 0.6), $thin: false);
    font-variant-numeric: tabular-nums;
  }
}
</style>
