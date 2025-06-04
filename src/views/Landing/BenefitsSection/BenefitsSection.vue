<!-- File: src/views/Landing/BenefitsSection/BenefitsSection.vue -->

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
      <h2 class="first-title"> <span class="gradient-text">Tout</span> est pour <span class="gradient-text">vous</span> </h2>
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
@use '@/assets/styles/variables/globals' as *;

#benefits-section {
  height: 100vh !important;
  padding-top: calc(var(--gutter-spacing) + 55px);

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  @include gutters(padding, bottom, 6);

  @include min-width(lg) {
    padding-top: calc(var(--gutter-spacing) + 70px);
    @include gutters(padding, bottom, 3);
  }

  .container {
    display: flex;
    flex-direction: column;
    align-items: center;

    .first-title {
      padding-top: 1rem;
      margin: 0 !important;
      @include h2-title($accent);
    }
  }

  .interaction-container {
    width: 100%;
    height: 100%;

    gap: 1.5rem;

    display: flex;
    flex-direction: column-reverse;
    align-items: center;

    @include min-width(lg) {
      flex-direction: column;
    }
  }
}
</style>
