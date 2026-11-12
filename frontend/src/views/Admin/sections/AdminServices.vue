<!-- File: src/views/Admin/sections/AdminServices.vue -->

<!-- Santé des services : le schéma en direct (relu toutes les 15 s), le détail du service choisi
     (dernière mesure, chiffres, 24 dernières heures) et les derniers changements d'état. L'autre
     vue montre la carte du code dessinée par floorplan. -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Mail, RefreshCw } from 'lucide-vue-next'

import type { HealthIncident, ServiceId, SystemHealth } from '@/domain/api/admin'
import { SERVICE_STATUS, formatAgo, formatDate, formatDateTime, formatEvery, formatPercent, pluralize } from '@/views/Admin/adminFormat'
import { adminScrollBehavior, isAdminWideLayout } from '@/views/Admin/adminLayout'
import FloorplanMap from '@/views/Admin/components/FloorplanMap.vue'
import ServiceDiagram from '@/views/Admin/components/ServiceDiagram.vue'
import UptimeStrip from '@/views/Admin/components/UptimeStrip.vue'

const props = defineProps<{
  health: SystemHealth | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refreshNotice: string | null
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'retry'): void
}>()

type View = 'live' | 'map'
const view = ref<View>('live')
const selectedId = ref<ServiceId | null>(null)

// Horloge pour « mis à jour il y a … » (une seconde suffit).
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
})

const services = computed(() => props.health?.services ?? [])

// Par défaut, le premier service en panne, sinon le serveur.
watch(services, (list) => {
  if (selectedId.value && list.some((service) => service.id === selectedId.value)) return
  selectedId.value = list.find((service) => service.status === 'down')?.id ?? list.find((service) => service.id === 'api')?.id ?? list[0]?.id ?? null
}, { immediate: true })

const selected = computed(() => services.value.find((service) => service.id === selectedId.value) ?? null)

const overall = computed(() => {
  const health = props.health
  if (!health) return null
  const { down, degraded } = health.overall
  const measured = health.services.some((service) => service.status !== 'unknown')
  if (!measured) return { tone: 'muted', text: 'Premières mesures en cours…' }
  if (down) return { tone: 'bad', text: `${pluralize(down, 'service en panne', 'services en panne')}${degraded ? `, ${pluralize(degraded, 'autre à surveiller', 'autres à surveiller')}` : ''}.` }
  if (degraded) return { tone: 'warn', text: `Tout tourne, ${pluralize(degraded, 'point à surveiller', 'points à surveiller')}.` }
  return { tone: 'good', text: 'Tous les services fonctionnent.' }
})

const updatedAgo = computed(() => formatAgo(props.health?.generatedAtISO ?? null, now.value))

const uptimeLabel = computed(() => {
  const service = selected.value
  if (!service) return ''
  const uptime = service.uptime24h
  return uptime === null
    ? `${service.label} : pas encore de mesure sur 24 heures.`
    : `${service.label} : disponible ${formatPercent(uptime)} du temps mesuré sur les dernières 24 heures.`
})

const DAY_MS = 24 * 60 * 60 * 1000
const BUCKET_MS = 30 * 60 * 1000

/**
 * Disponibilité sur 7 et 30 jours, avec la vraie période couverte tant que la base n'a pas encore
 * l'historique complet (les semaines qui suivent la mise en service, ou un service ajouté depuis).
 */
const longerUptime = computed(() => {
  const service = selected.value
  if (!service?.historySinceISO) return []
  const since = Date.parse(service.historySinceISO)
  // Moins de 24 h gardées : ces chiffres répéteraient la bande des dernières 24 heures.
  if (Number.isNaN(since) || since > now.value - DAY_MS) return []
  // La première demi-heure gardée commence au plus une demi-heure après le début de la fenêtre.
  const covers = (days: number) => since <= now.value - days * DAY_MS + BUCKET_MS
  const sinceLabel = `Depuis le ${formatDate(service.historySinceISO)}`
  const rows: Array<{ label: string; value: string }> = []
  if (service.uptime7d !== null) rows.push({ label: covers(7) ? 'Sur 7 jours' : sinceLabel, value: formatPercent(service.uptime7d) })
  if (service.uptime30d !== null && covers(7)) rows.push({ label: covers(30) ? 'Sur 30 jours' : sinceLabel, value: formatPercent(service.uptime30d) })
  return rows
})

function fromLabel(incident: HealthIncident): string {
  return incident.from === 'unknown' ? 'Au démarrage' : SERVICE_STATUS[incident.from].label
}

const alertsText = computed(() => {
  const alerts = props.health?.alerts
  if (!alerts) return null
  if (!alerts.enabled) return alerts.reason ?? 'Pas d’alerte par e-mail.'
  const { confirmSeconds, recoveryMinutes, gapMinutes, maxPerDay } = alerts.rules
  return `Alertes par e-mail à ${alerts.recipients.join(', ')} quand un service tombe (panne confirmée ${confirmSeconds} s plus tard) ou qu’un certificat ou une tâche planifiée passe « à surveiller », puis quand il fonctionne de nouveau depuis ${recoveryMinutes} min. Au plus un e-mail de panne par service toutes les ${gapMinutes} min, et ${maxPerDay} sur 24 h. Si le serveur lui-même s’arrête, rien ne part.`
})

const deliveryWarning = computed(() => {
  const alerts = props.health?.alerts
  const delivery = alerts?.lastDelivery
  if (!alerts?.enabled || !delivery || delivery.ok) return null
  return `Le dernier e-mail d’alerte n’est pas parti (${formatDateTime(delivery.atISO)}) : nouvel essai ${alerts.rules.gapMinutes} min plus tard.`
})

function selectService(id: ServiceId) {
  selectedId.value = id
  if (typeof window === 'undefined') return
  // Le détail est sous le schéma à toutes les largeurs : on l'amène à l'écran. Téléphone et tablette :
  // la page descend jusqu'à lui. Ordinateur (zone qui défile seule) : juste assez pour le montrer.
  const block: ScrollLogicalPosition = isAdminWideLayout() ? 'nearest' : 'start'
  window.requestAnimationFrame(() => {
    document.getElementById('admin-service-detail')?.scrollIntoView({ behavior: adminScrollBehavior(), block })
  })
}
</script>

<template>
  <section
    class="admin-services"
    :class="{ 'is-map': view === 'map' }"
    aria-label="Santé des services"
  >
    <div class="toolbar">
      <div
        class="views"
        role="tablist"
        aria-label="Affichage"
      >
        <div
          class="view"
          :class="{ 'is-active': view === 'live' }"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="view === 'live'"
            @click="view = 'live'"
          >
            En direct
          </button>
        </div>
        <div
          class="view"
          :class="{ 'is-active': view === 'map' }"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="view === 'map'"
            @click="view = 'map'"
          >
            Carte du code
          </button>
        </div>
      </div>

      <div
        v-if="view === 'live' && health"
        class="live"
      >
        <span
          class="beacon"
          aria-hidden="true"
        />
        <span
          class="updated"
          aria-live="off"
        >Mis à jour {{ updatedAgo }}</span>
        <div class="refresh">
          <button
            type="button"
            :disabled="isRefreshing"
            @click="emit('refresh')"
          >
            <RefreshCw
              :size="16"
              aria-hidden="true"
            />
            {{ isRefreshing ? 'Contrôles en cours…' : 'Tout recontrôler' }}
          </button>
        </div>
      </div>
    </div>

    <template v-if="view === 'live'">
      <p
        v-if="isLoading && !health"
        class="state"
        role="status"
      >
        Lecture de l’état des services…
      </p>

      <div
        v-else-if="error && !health"
        class="state is-error"
        role="alert"
      >
        <p>{{ error }}</p>
        <div class="retry">
          <button
            type="button"
            @click="emit('retry')"
          >
            <RefreshCw
              :size="16"
              aria-hidden="true"
            />
            Réessayer
          </button>
        </div>
      </div>

      <template v-else-if="health">
        <p
          v-if="overall"
          class="overall"
          :class="`is-${overall.tone}`"
          role="status"
        >
          <span
            class="dot"
            aria-hidden="true"
          />
          {{ overall.text }}
        </p>
        <p
          v-if="error"
          class="notice"
          role="alert"
        >
          Dernière lecture impossible ({{ error }}) : l’état affiché date de {{ formatDateTime(health.generatedAtISO) }}.
        </p>
        <p
          v-if="refreshNotice"
          class="notice"
        >
          {{ refreshNotice }}
        </p>
        <p
          v-if="health.environment !== 'production'"
          class="notice"
        >
          Serveur de développement : l’accès public et les certificats ne sont contrôlés qu’en production.
        </p>

        <ServiceDiagram
          :services="services"
          :selected-id="selectedId"
          @select="selectService"
        />

        <section
          v-if="selected"
          id="admin-service-detail"
          class="detail"
          :aria-label="`Détail : ${selected.label}`"
        >
          <header class="detail-head">
            <h3>{{ selected.label }}</h3>
            <span
              class="badge"
              :class="`is-${SERVICE_STATUS[selected.status].tone}`"
            >{{ SERVICE_STATUS[selected.status].label }}</span>
          </header>
          <p class="role">{{ selected.role }}</p>
          <p class="summary">{{ selected.summary }}</p>

          <dl
            v-if="selected.facts.length"
            class="facts"
          >
            <div
              v-for="fact in selected.facts"
              :key="fact.label"
              :class="fact.tone ? `is-${fact.tone}` : ''"
            >
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}</dd>
            </div>
          </dl>

          <div class="uptime">
            <p class="uptime-title">
              Dernières 24 heures
              <strong v-if="selected.uptime24h !== null">· disponible {{ formatPercent(selected.uptime24h) }}</strong>
            </p>
            <UptimeStrip
              :history="selected.history"
              :label="uptimeLabel"
            />
            <dl
              v-if="longerUptime.length"
              class="longer"
            >
              <div
                v-for="row in longerUptime"
                :key="row.label"
              >
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>
          </div>

          <p class="meta">
            Dernière mesure {{ formatAgo(selected.checkedAtISO, now) }}, contrôlé {{ formatEvery(selected.everyMs) }}.
          </p>
        </section>

        <section
          class="incidents"
          aria-labelledby="admin-incidents-title"
        >
          <h3 id="admin-incidents-title">Derniers changements</h3>
          <ul
            v-if="health.incidents.length"
            class="rows"
          >
            <li
              v-for="incident in health.incidents.slice(0, 12)"
              :key="`${incident.atISO}-${incident.serviceId}`"
            >
              <span class="when">{{ formatDateTime(incident.atISO) }}</span>
              <span class="what">
                <strong>{{ incident.label }}</strong>
                <span>
                  {{ fromLabel(incident) }} →
                  <span :class="`is-${SERVICE_STATUS[incident.to].tone}`">{{ SERVICE_STATUS[incident.to].label }}</span>
                </span>
              </span>
              <span class="why">
                {{ incident.summary }}
                <span
                  v-if="incident.alerted"
                  class="alerted"
                >
                  <Mail
                    :size="14"
                    aria-hidden="true"
                  />
                  E-mail envoyé
                </span>
              </span>
            </li>
          </ul>
          <p
            v-else
            class="empty"
          >
            Aucun changement d’état enregistré.
          </p>
          <p
            v-if="alertsText"
            class="alerts"
            :class="{ 'is-off': !health.alerts.enabled }"
          >
            {{ alertsText }}
          </p>
          <p
            v-if="deliveryWarning"
            class="alerts is-off"
            role="status"
          >
            {{ deliveryWarning }}
          </p>
          <p class="footnote">
            <template v-if="health.historyPersisted">Historique gardé 90 jours en base, journal 180 jours.</template>
            <template v-else>La base ne répond pas : l’historique n’est gardé qu’en mémoire jusqu’à son retour.</template>
            Mesures en cours depuis le {{ formatDateTime(health.monitoringSinceISO) }} (dernier démarrage du serveur).
          </p>
        </section>
      </template>
    </template>

    <FloorplanMap v-else />
  </section>
</template>

<style lang="scss">
@use '@/views/Admin/sections/admin-services.scss';
</style>
