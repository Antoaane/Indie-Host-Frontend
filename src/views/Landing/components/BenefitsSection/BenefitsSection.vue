<!-- File: src/views/Landing/components/BenefitsSection/BenefitsSection.vue -->

<script setup lang="ts">
// UTILS
import useBookingCalc from '@/views/Landing/components/BenefitsSection/utils/useBookingCalc'
// COMPONENTS
import AnimationPanel from '@/views/Landing/components/BenefitsSection/components/AnimationPanel/AnimationPanel.vue'
import CalcTitle from '@/views/Landing/components/BenefitsSection/components/CalcTitle/CalcTitle.vue'
// CONTENT
import type { BenefitsContent } from '@/views/Landing/types/content'

const props = defineProps<{
  content: BenefitsContent
}>()

const { nights, price, total, commissions } = useBookingCalc()
</script>

<template>
  <section id="benefits-section">
    <div class="wrapper">
      <h2
        class="first-title"
        v-html="content.title"
      />
    </div>

    <div class="interaction-container">
      <AnimationPanel
        :total="total"
        :commissions="commissions"
      />

      <CalcTitle
        :total="total"
        :commissions="commissions"
        v-model:nights="nights"
        v-model:price="price"
      />
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/BenefitsSection/benefits-section.scss';
</style>
