<!-- File: src/views/Landing/BenefitsSection/index.vue -->

<script setup lang="ts">
// UTILS
import useBookingCalc from '@/views/Landing/BenefitsSection/utils/useBookingCalc'

// COMPONENTS
import AnimationPanel from '@/views/Landing/BenefitsSection/components/AnimationPanel/AnimationPanel.vue'
import CalcTitle from '@/views/Landing/BenefitsSection/components/CalcTitle.vue'

// ASSETS

const { nights, price, total, commissions } = useBookingCalc()
</script>

<template>
  <section id="benefits-section">
    <div class="container">
      <h2 class="first-tite"> <span class="gradient-text">Tout</span> est pour <span class="gradient-text">vous</span> </h2>
    </div>

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
  </section>
</template>

<style lang="scss" scoped>
@use '@/views/Landing/BenefitsSection/style.scss';
</style>
