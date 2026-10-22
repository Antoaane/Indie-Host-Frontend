<!-- File: src/views/Landing/components/BenefitsSection/components/CalcTitle/CalcTitle.vue -->

<script setup lang="ts">
// DEPS
// ASSETS

const nights = defineModel<number>('nights')
const price = defineModel<number>('price')

defineProps<{
  total: number
  commissions: number
}>()
</script>

<template>
  <div class="wrapper">
    <h2 class="second-title">
      Votre logement pourrait vous rapporter <strong>{{ commissions }} €</strong> de <strong>plus</strong>
    </h2>
    <p>
      <span class="calc-input">
        <span class="value">{{ nights }}</span>
        <input
          type="number"
          inputmode="numeric"
          v-model="nights"
        />
      </span>
      nuits |
      <span class="calc-input">
        <span class="value">{{ price }}</span>
        <input
          type="number"
          inputmode="numeric"
          v-model="price"
        />
      </span>
      €/nuit
    </p>
  </div>
</template>

<style lang="scss">
@use '@/views/Landing/components/BenefitsSection/components/CalcTitle/calc-title.scss';
</style>
