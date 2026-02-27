// File: src/views/Landing/components/BenefitsSection/utils/useBookingCalc.ts

import { ref, computed } from 'vue'

export default function useBookingCalc() {
  const nights = ref(6)
  const price = ref(130)

  const total = computed(() => nights.value * price.value)
  const commissions = computed(() => Math.ceil(total.value * 0.20))

  return { nights, price, total, commissions }
}
