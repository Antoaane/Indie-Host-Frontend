<script setup lang="ts">
const props = defineProps<{
  expanded: boolean
  priceBreakdown: Array<{ label: string; amount: string }>
  currency: Intl.NumberFormat
  total: number
}>()
</script>

<template>
  <transition name="summary-toggle">
    <div
      v-show="props.expanded"
      class="checkout-card__summary"
    >
      <div
        v-for="line in props.priceBreakdown"
        :key="line.label"
        class="checkout-card__line"
      >
        <p>{{ line.label }}</p>
        <span>{{ line.amount }}</span>
      </div>
      <div class="checkout-card__line checkout-card__line--total">
        <p>Total</p>
        <span>{{ props.currency.format(props.total) }}</span>
      </div>
    </div>
  </transition>
</template>
