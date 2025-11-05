<!-- File: src/views/Landing/components/BenefitsSection/BenefitsSection.vue -->

<script setup lang="ts">
// UTILS
import useBookingCalc from '@/views/Landing/components/BenefitsSection/utils/useBookingCalc'
// COMPONENTS
import AnimationPanel from '@/views/Landing/components/BenefitsSection/components/AnimationPanel/AnimationPanel.vue'
import CalcTitle from '@/views/Landing/components/BenefitsSection/components/CalcTitle/CalcTitle.vue'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/benefits-section.json'

const section = rawContent as ItemSection

const { nights, price, total, commissions } = useBookingCalc()
</script>

<template>
  <section :id="section.id">
    <div class="wrapper">
      <h2
        class="first-title"
        v-html="section.items['title-1'].content"
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
