<!-- File: src/components/svgs/svgs-old/GradiantSeparator.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 2208 908"
  >
    <g clip-path="url(#clip0_1349_29685)">
      <g filter="url(#filter0_f_1349_29685)">
        <ellipse
          cx="159.223"
          cy="181.056"
          fill="#A499FF"
          rx="601.553"
          ry="478.656"
        />
        <ellipse
          cx="1004.75"
          cy="83.6431"
          fill="#DF99FF"
          rx="553.181"
          ry="313.881"
          transform="rotate(-18.1802 1004.75 83.6431)"
        />
        <ellipse
          cx="1854.14"
          cy="34.1748"
          fill="#FFC4C5"
          opacity="0.8"
          rx="584.491"
          ry="345.042"
          transform="rotate(24.8632 1854.14 34.1748)"
        />
      </g>
      <rect
        width="2207"
        height="908"
        fill="url(#paint0_linear_1349_29685)"
        fill-opacity="0.3"
      />
      <rect
        width="2207"
        height="908"
        fill="url(#paint1_radial_1349_29685)"
      />
    </g>
    <defs>
      <filter
        id="filter0_f_1349_29685"
        width="3642.75"
        height="2209.47"
        x="-840.498"
        y="-762.006"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood
          flood-opacity="0"
          result="BackgroundImageFix"
        />
        <feBlend
          in="SourceGraphic"
          in2="BackgroundImageFix"
          mode="normal"
          result="shape"
        />
        <feGaussianBlur
          result="effect1_foregroundBlur_1349_29685"
          stdDeviation="199.084"
        />
      </filter>
      <linearGradient
        id="paint0_linear_1349_29685"
        x1="1104.14"
        x2="1104"
        y1="0.0106902"
        y2="193.5"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#FCFAFA" />
        <stop
          offset="1"
          stop-color="#FCFAFA"
          stop-opacity="0"
        />
      </linearGradient>
      <radialGradient
        id="paint1_radial_1349_29685"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(888.5 908) rotate(83.0931) scale(798.293 1905.97)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#111117" />
        <stop
          offset="1"
          stop-color="#111117"
          stop-opacity="0"
        />
      </radialGradient>
      <clipPath id="clip0_1349_29685">
        <rect
          width="2208"
          height="908"
          fill="white"
        />
      </clipPath>
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
    console.warn('[GradiantSeparator.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
