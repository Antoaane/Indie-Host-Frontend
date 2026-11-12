<!-- File: src/views/Admin/components/ServiceDiagram.vue -->

<!-- Schéma d'IndieHost en direct : d'où viennent les visites (Internet), par où elles passent
     (aiguillage nginx), les deux applications (site et serveur), puis ce dont le serveur dépend.
     Chaque service porte son état ; une ligne vers un service en panne passe au rouge.
     Sur ordinateur, quatre colonnes reliées par des lignes ; sur téléphone et tablette, les mêmes
     cartes rangées par couche, sans lignes. -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component, type ComponentPublicInstance } from 'vue'
import {
  Bot,
  CalendarClock,
  CalendarSync,
  CreditCard,
  Database,
  Globe,
  Image,
  KeyRound,
  Mail,
  Map as MapIcon,
  MonitorSmartphone,
  Server,
  ShieldCheck,
  Waypoints,
} from 'lucide-vue-next'

import type { ServiceHealth, ServiceId, ServiceStatus } from '@/domain/api/admin'
import { vp } from '@/utils/viewport'
import { SERVICE_STATUS } from '@/views/Admin/adminFormat'

const props = defineProps<{
  services: ServiceHealth[]
  selectedId: ServiceId | null
}>()

const emit = defineEmits<{
  (e: 'select', id: ServiceId): void
}>()

const ICONS: Record<ServiceId, Component> = {
  public: Globe,
  certificates: ShieldCheck,
  proxy: Waypoints,
  site: MonitorSmartphone,
  api: Server,
  database: Database,
  scraping: Bot,
  jobs: CalendarClock,
  calendars: CalendarSync,
  stripe: CreditCard,
  clerk: KeyRound,
  email: Mail,
  imagekit: Image,
  maps: MapIcon,
}

const COLUMNS: Array<{ id: string; groups: Array<{ title: string; ids: ServiceId[] }> }> = [
  { id: 'internet', groups: [{ title: 'Internet', ids: ['public', 'certificates'] }] },
  { id: 'proxy', groups: [{ title: 'Aiguillage', ids: ['proxy'] }] },
  { id: 'apps', groups: [{ title: 'Applications', ids: ['site', 'api'] }] },
  {
    id: 'behind',
    groups: [
      { title: 'Données et tâches', ids: ['database', 'scraping', 'jobs', 'calendars'] },
      { title: 'Services extérieurs', ids: ['stripe', 'clerk', 'email', 'imagekit', 'maps'] },
    ],
  },
]

// Qui dépend de qui : la ligne prend l'état du service d'arrivée.
const EDGES: Array<[ServiceId, ServiceId]> = [
  ['public', 'proxy'],
  ['certificates', 'proxy'],
  ['proxy', 'site'],
  ['proxy', 'api'],
  ['api', 'database'],
  ['api', 'scraping'],
  ['api', 'jobs'],
  ['api', 'calendars'],
  ['api', 'stripe'],
  ['api', 'clerk'],
  ['api', 'email'],
  ['api', 'imagekit'],
  ['site', 'maps'],
]

const byId = computed(() => new Map(props.services.map((service) => [service.id, service])))

function statusOf(id: ServiceId): ServiceStatus {
  return byId.value.get(id)?.status ?? 'unknown'
}

function toneOf(id: ServiceId): string {
  return `is-${SERVICE_STATUS[statusOf(id)].tone}`
}

function stateLine(id: ServiceId): string {
  const service = byId.value.get(id)
  if (!service) return SERVICE_STATUS.unknown.label
  const label = SERVICE_STATUS[service.status].label
  // Espace insécable : le nombre et son unité ne se séparent pas en bout de ligne.
  return service.latencyMs !== null && service.status !== 'down' ? `${label} · ${service.latencyMs} ms` : label
}

// --- Lignes entre les cartes (ordinateur) ---------------------------------------------------

const root = ref<HTMLElement | null>(null)
const nodeEls = new Map<ServiceId, HTMLElement>()
const paths = ref<Array<{ key: string; d: string; tone: string }>>([])
let resizeObserver: ResizeObserver | null = null
let frame = 0

function setNodeRef(id: ServiceId, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) nodeEls.set(id, el)
  else nodeEls.delete(id)
}

function measure() {
  frame = 0
  const container = root.value
  if (!container || !vp.lg.value) {
    paths.value = []
    return
  }
  const box = container.getBoundingClientRect()
  paths.value = EDGES.flatMap(([from, to]) => {
    const a = nodeEls.get(from)?.getBoundingClientRect()
    const b = nodeEls.get(to)?.getBoundingClientRect()
    if (!a || !b) return []
    const x1 = a.right - box.left
    const y1 = a.top + a.height / 2 - box.top
    const x2 = b.left - box.left
    const y2 = b.top + b.height / 2 - box.top
    const mid = (x1 + x2) / 2
    return [{ key: `${from}-${to}`, d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`, tone: toneOf(to) }]
  })
}

function scheduleMeasure() {
  if (typeof window === 'undefined' || frame) return
  frame = window.requestAnimationFrame(measure)
}

onMounted(() => {
  scheduleMeasure()
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(root.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (frame && typeof window !== 'undefined') window.cancelAnimationFrame(frame)
})

watch(() => props.services.map((service) => `${service.id}:${service.status}:${service.latencyMs}`).join('|'), () => {
  void nextTick(scheduleMeasure)
})
watch(() => vp.lg.value, () => {
  void nextTick(scheduleMeasure)
})
</script>

<template>
  <div
    ref="root"
    class="admin-service-diagram"
  >
    <svg
      class="edges"
      aria-hidden="true"
      focusable="false"
    >
      <path
        v-for="path in paths"
        :key="path.key"
        :d="path.d"
        :class="path.tone"
      />
    </svg>

    <div class="columns">
      <div
        v-for="column in COLUMNS"
        :key="column.id"
        class="column"
      >
        <section
          v-for="group in column.groups"
          :key="group.title"
          class="group"
          :aria-label="group.title"
        >
          <h3>{{ group.title }}</h3>
          <ul class="nodes">
            <li
              v-for="id in group.ids"
              :key="id"
            >
              <button
                :ref="(el) => setNodeRef(id, el)"
                type="button"
                class="node"
                :class="[toneOf(id), { 'is-selected': id === selectedId }]"
                :aria-pressed="id === selectedId"
                @click="emit('select', id)"
              >
                <span
                  class="icon"
                  aria-hidden="true"
                >
                  <component
                    :is="ICONS[id]"
                    :size="18"
                  />
                </span>
                <span class="text">
                  <span class="name">{{ byId.get(id)?.label ?? id }}</span>
                  <span class="state">
                    <span
                      class="dot"
                      aria-hidden="true"
                    >
                      <span
                        :key="byId.get(id)?.checkedAtISO ?? 'none'"
                        class="pulse"
                      />
                    </span>
                    {{ stateLine(id) }}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
/* File: src/views/Admin/components/ServiceDiagram.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

@keyframes admin-service-pulse {
  from {
    opacity: 0.55;
    transform: scale(1);
  }

  to {
    opacity: 0;
    transform: scale(2.6);
  }
}

.admin-service-diagram {
  position: relative;
  min-width: 0;

  > .edges {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
    display: none;

    @include min-width(lg) {
      display: block;
    }

    > path {
      fill: none;
      stroke: rgba($secondary, 0.22);
      stroke-width: 1.5;
      stroke-linecap: round;

      &.is-warn {
        stroke: $warn-ink;
      }

      &.is-bad {
        stroke: $bad-ink;
        stroke-width: 2;
      }

      &.is-muted {
        stroke: rgba($secondary, 0.1);
      }
    }
  }

  // Téléphone et tablette : une couche sous l'autre. Ordinateur : quatre colonnes.
  > .columns {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--layout-gap-xl);

    @include min-width(lg) {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 0.85fr)) minmax(0, 1fr);
      column-gap: calc(var(--layout-gap) * 3);
      align-items: center;
    }

    > .column {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xl);

      > .group {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--layout-gap-xs);

        > h3 {
          margin: 0;
          @include little-text(rgba($secondary-text, 0.68), $bold: true);
        }

        > .nodes {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 10rem), 1fr));
          gap: var(--layout-gap-xs);

          @include min-width(lg) {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      }
    }
  }

  .node {
    width: 100%;
    min-height: var(--tap-target);
    padding: var(--layout-gap-xs) var(--layout-gap-sm);
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--layout-gap-sm);
    border: 1px solid rgba($secondary, 0.1);
    border-radius: borders.$rounded-md;
    background: $accent-surface-0;
    color: $secondary-text;
    text-align: left;
    cursor: pointer;
    @include animations.transition(animations.$duration-fast);
    @include animations.press(0.98);

    @include on-hover {
      border-color: rgba($secondary, 0.28);
    }

    &:focus-visible {
      outline: 2px solid $secondary;
      outline-offset: 2px;
    }

    &.is-selected {
      border-color: $secondary;
      background: $accent-surface-2;
    }

    &.is-bad {
      border-color: $bad-ink;
    }

    > .icon {
      width: 2rem;
      height: 2rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: borders.$rounded-sm;
      background: rgba($secondary, 0.06);
      color: rgba($secondary-text, 0.8);
    }

    > .text {
      min-width: 0;
      display: flex;
      flex-direction: column;

      > .name {
        @include little-text($secondary-text, $bold: true);
        overflow-wrap: anywhere;
      }

      > .state {
        display: inline-flex;
        align-items: center;
        gap: var(--layout-gap-xs);
        @include little-text(rgba($secondary-text, 0.72), $thin: false);
        font-variant-numeric: tabular-nums;

        > .dot {
          position: relative;
          flex: 0 0 auto;
          width: 0.55rem;
          height: 0.55rem;
          border-radius: borders.$rounded;
          background: rgba($secondary, 0.25);

          // Un anneau s'élargit une fois quand le service vient d'être mesuré.
          > .pulse {
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: inherit;
            opacity: 0;
            animation: admin-service-pulse calc(#{animations.$duration-overlay} * 3) animations.$ease-out 1;

            @include animations.reduced-motion {
              animation: none;
            }
          }
        }
      }
    }

    &.is-good > .text > .state > .dot {
      background: $good-ink;
    }

    &.is-warn > .text > .state > .dot {
      background: $warn-ink;
    }

    &.is-bad > .text > .state {
      color: $bad-ink;

      > .dot {
        background: $bad-ink;
      }
    }
  }
}
</style>
