<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 50 50"
  >
    <ellipse
      cx="24.9999"
      cy="13.8129"
      fill="url(#paint0_linear_277_777)"
      rx="7.00979"
      ry="6.72368"
    />
    <path
      fill="url(#paint1_linear_277_777)"
      d="M24.9999 20.5366L13.8414 42.9107H36.1583L24.9999 20.5366Z"
    />
    <defs>
      <linearGradient
        id="paint0_linear_277_777"
        x1="24.9999"
        x2="24.9999"
        y1="7.08923"
        y2="20.5366"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0.484"
          stop-color="#111117"
        />
        <stop
          offset="1"
          stop-color="#111117"
          stop-opacity="0"
        />
      </linearGradient>
      <linearGradient
        id="paint1_linear_277_777"
        x1="24.9999"
        x2="24.9999"
        y1="20.5366"
        y2="42.9107"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0.684"
          stop-color="#111117"
        />
        <stop
          offset="1"
          stop-color="#111117"
          stop-opacity="0"
        />
      </linearGradient>
    </defs>
    <title
      v-if="!ariaHidden"
      :id="'titleId'"
    >
      {{ title }}
    </title>
    <desc
      v-if="!ariaHidden"
      :id="'descId'"
    >
      {{ desc }}
    </desc>
  </svg>
</template>

<script setup lang="ts">
import { computed, onMounted, withDefaults } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    desc?: string
    role?: boolean | string
  }>(),
  { role: true },
)

// computed 100 % typés pour éviter les erreurs TS
const attrRole = computed(() => (props.role === true ? undefined : String(props.role)))
const ariaHidden = computed(() => props.role === true)
const ariaLabelledBy = computed(() => (props.role === true ? undefined : 'titleId descId'))

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[LogoIconLight.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
