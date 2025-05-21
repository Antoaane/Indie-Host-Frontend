<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { VueLenis, useLenis } from 'lenis/vue'

// ASSETS
import HeroSection from '@/views/Landing/HeroSection.vue'
import BenefitsSection from '@/views/Landing/WhySection/BenefitsSection.vue'
import CustomizationSection from '@/views/Landing/WhySection/CustomizationSection.vue'
import HabitsSection from '@/views/Landing/WhySection/HabitsSection.vue'
import StrengthsSection from '@/views/Landing/StrengthsSection.vue'
import UsageSection from '@/views/Landing/UsageSection.vue'
import JoinSection from '@/views/Landing/JoinSection.vue'
import FaqSection from '@/views/Landing/FaqSection.vue'

// State
const sections = ref<HTMLElement[]>([])
const current = ref(0)
const lenis = useLenis()

const threshold = 40
const visibleOffset = 1
const isDesktop = () => window.innerWidth > 1025

onMounted(() => {
  if (!isDesktop()) return

  sections.value = Array.from(document.querySelectorAll('section')).filter((el) => !el.classList.contains('no-snap')) as HTMLElement[]

  // Scroll detection
  window.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('scroll', detectCurrentSection, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('wheel', handleWheel)
  window.removeEventListener('scroll', detectCurrentSection)
})

function handleWheel(e: WheelEvent) {
  if (!isDesktop() || Math.abs(e.deltaY) < threshold) return

  const direction = e.deltaY > 0 ? 1 : -1
  const next = current.value + direction
  const nextSection = sections.value[next]
  if (!nextSection) return

  const rect = nextSection.getBoundingClientRect()
  const isVisible = direction > 0 ? rect.top < window.innerHeight - visibleOffset : rect.bottom > visibleOffset

  if (!isVisible) return

  e.preventDefault()
  current.value = next

  lenis.value?.scrollTo(nextSection, {
    duration: 0.75,
    easing: (t) => t * (2 - t),
    lock: true,
  })
}

// 🔄 Sync current section from natural scroll
function detectCurrentSection() {
  if (!isDesktop()) return

  const scrollY = window.scrollY
  let closestIndex = 0
  let smallestDistance = Infinity

  sections.value.forEach((section, index) => {
    const offsetTop = section.offsetTop
    const distance = Math.abs(offsetTop - scrollY)

    if (distance < smallestDistance) {
      smallestDistance = distance
      closestIndex = index
    }
  })

  current.value = closestIndex
}
</script>

<template>
  <VueLenis root>
    <main id="landing-page">
      <HeroSection />
      <BenefitsSection />
      <HabitsSection />
      <CustomizationSection />
      <StrengthsSection />
      <UsageSection />
      <JoinSection />
      <FaqSection />
    </main>
  </VueLenis>
</template>
