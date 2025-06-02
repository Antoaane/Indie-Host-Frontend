<!-- File: src/views/Landing/BenefitsSection/components/CalcTitle.vue -->

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
      Votre logement pourrait vous rapporter <span class="gradient-text">{{ commissions }} €</span> de <span class="gradient-text">plus</span>
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

<style lang="scss" scoped>
@use '@/assets/styles/variables/globals' as *;

.second-title {
  width: 100%;
  max-width: 30rem;
  margin-bottom: 0.5rem;

  text-align: center;
  @include h3-title($accent);
}

p {
  text-decoration: underline !important;
  text-underline-offset: 0.3rem;

  @include base-text($accent);

  span {
    display: inline-block;
    position: relative;

    text-decoration: underline !important;
    text-underline-offset: 0.3rem;
    @include base-text($accent);

    input {
      width: 115%;
      height: 100%;

      position: absolute;
      z-index: 9999;
      top: 50%;
      left: 50%;

      transform: translate(-50%, -50%);

      font-size: 1.125rem;
      color: #00000000;

      background-color: #00000000;
      border: none;

      // hide arrow
      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      &:focus {
        color: $accent;
      }
    }
  }
}
</style>
