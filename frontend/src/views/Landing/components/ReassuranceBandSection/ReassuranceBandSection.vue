<!-- File: src/views/Landing/components/ReassuranceBandSection/ReassuranceBandSection.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type ReassuranceItem = {
  id: 'time' | 'rank' | 'savings'
  target: number
  durationMs: number
  description: string
}

const numberFormat = new Intl.NumberFormat('fr-FR')

const reassuranceItems: ReassuranceItem[] = [
  {
    id: 'time',
    target: 5,
    durationMs: 1100,
    description: 'Le délai maximum pour être prêt à encaisser vos premières réservations en ligne.',
  },
  {
    id: 'rank',
    target: 1,
    durationMs: 900,
    description: "des outils 'Zéro Technique' en France",
  },
  {
    id: 'savings',
    target: 1200,
    durationMs: 1550,
    description: 'Le montant moyen des commissions économisées après seulement 3 mois',
  },
]

const sectionRef = ref<HTMLElement | null>(null)
const hasStarted = ref(false)
const isSectionVisible = ref(false)
const displayedValues = ref<Record<ReassuranceItem['id'], number>>({
  time: 0,
  rank: 0,
  savings: 0,
})

const rafIds = new Set<number>()
let observer: IntersectionObserver | null = null
let startDelayTimeoutId: ReturnType<typeof setTimeout> | null = null
const animationStartDelayMs = 320

const displayedItems = computed(() =>
  reassuranceItems.map((item) => ({
    ...item,
    value: formatItemValue(item.id, displayedValues.value[item.id]),
  })),
)

function formatItemValue(id: ReassuranceItem['id'], value: number): string {
  if (id === 'time') return `${value} minutes`
  if (id === 'rank') return `N°${value}`
  return `${numberFormat.format(value)} €`
}

function animateCounter(item: ReassuranceItem) {
  const startValue = 0
  const startTime = performance.now()

  const tick = (timestamp: number) => {
    const elapsed = timestamp - startTime
    const progress = Math.min(1, elapsed / item.durationMs)
    const eased = 1 - Math.pow(1 - progress, 3)
    const value = Math.round(startValue + (item.target - startValue) * eased)

    displayedValues.value[item.id] = value

    if (progress < 1) {
      const nextRafId = requestAnimationFrame(tick)
      rafIds.add(nextRafId)
      return
    }

    displayedValues.value[item.id] = item.target
  }

  const rafId = requestAnimationFrame(tick)
  rafIds.add(rafId)
}

function startAnimation() {
  if (hasStarted.value) return
  hasStarted.value = true
  reassuranceItems.forEach((item) => animateCounter(item))
}

function clearStartDelayTimeout() {
  if (startDelayTimeoutId === null) return
  clearTimeout(startDelayTimeoutId)
  startDelayTimeoutId = null
}

function scheduleAnimationStart() {
  if (hasStarted.value || startDelayTimeoutId !== null) return

  startDelayTimeoutId = setTimeout(() => {
    startDelayTimeoutId = null
    if (!isSectionVisible.value || hasStarted.value) return

    startAnimation()
    observer?.disconnect()
    observer = null
  }, animationStartDelayMs)
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    isSectionVisible.value = true
    scheduleAnimationStart()
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      isSectionVisible.value = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35)
      if (isSectionVisible.value) {
        scheduleAnimationStart()
        return
      }
      clearStartDelayTimeout()
    },
    {
      threshold: [0.25, 0.35, 0.55],
    },
  )

  if (sectionRef.value) observer.observe(sectionRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  clearStartDelayTimeout()
  rafIds.forEach((id) => cancelAnimationFrame(id))
  rafIds.clear()
})
</script>

<template>
  <section
    ref="sectionRef"
    id="reassurance-band-section"
    aria-label="Indicateurs de réassurance"
  >
    <div class="wrapper">
      <article
        v-for="item in displayedItems"
        :key="item.id"
        class="reassurance-item"
      >
        <p class="value">
          {{ item.value }}
        </p>
        <p class="description">
          {{ item.description }}
        </p>
      </article>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/ReassuranceBandSection/reassurance-band-section.scss';
</style>
