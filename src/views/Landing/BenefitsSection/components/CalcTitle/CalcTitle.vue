<!-- File: src/views/Landing/BenefitsSection/components/CalcTitle/CalcTitle.vue -->

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
  <div class="container">
    <h2 class="second-title">
      Votre logement pourrait vous rapporter <strong>{{ commissions }} €</strong> de <strong>plus</strong>
    </h2>
    <p>
      <span>
        {{ nights }}
        <input
          type="number"
          v-model="nights"
        />
      </span>
      nuits |
      <span>
        {{ price }}
        <input
          type="number"
          v-model="price"
        />
      </span>
      €/nuit
    </p>
  </div>
</template>

<style lang="scss">
@use '@/views/Landing/BenefitsSection/components/CalcTitle/calc-title.scss';
</style>
