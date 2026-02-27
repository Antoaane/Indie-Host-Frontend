<!-- File: src/components/svgs/images/GlowTopRightSharp.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 926 641"
  >
    <g :clip-path="url(ids.clip0_2108_134027)">
      <mask
        :id="ids.path_1_inside_1_2108_134027"
        fill="white"
      >
        <path d="M926 606C926 625.33 910.33 641 891 641L0 641L5.6038e-05 -8.09535e-05L926 0L926 606Z" />
      </mask>
      <g
        :filter="url(ids.filter0_f_2108_134027)"
        opacity="0.2"
      >
        <ellipse
          cx="926.17"
          cy="640.5"
          fill="#FCFAFA"
          rx="83"
          ry="112.5"
          transform="rotate(-180 926.17 640.5)"
        />
      </g>
    </g>
    <path
      :fill="url(ids.paint0_radial_2108_134027)"
      d="M926.75 606C926.75 625.744 910.744 641.75 891 641.75L-6.55671e-08 641.75L6.55671e-08 640.25L891 640.25C909.916 640.25 925.25 624.916 925.25 606L926.75 606ZM5.6038e-05 -8.09535e-05L926 0L5.6038e-05 -8.09535e-05ZM926.75 6.55671e-08L926.75 606C926.75 625.744 910.744 641.75 891 641.75L891 640.25C909.916 640.25 925.25 624.916 925.25 606L925.25 -6.55671e-08L926.75 6.55671e-08ZM0 641L5.6038e-05 -8.09535e-05L0 641Z"
      :mask="url(ids.path_1_inside_1_2108_134027)"
    />
    <defs>
      <filter
        :id="ids.filter0_f_2108_134027"
        width="566"
        height="625"
        x="643.17"
        y="328"
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
          result="effect1_foregroundBlur_2108_134027"
          stdDeviation="100"
        />
      </filter>
      <radialGradient
        :id="ids.paint0_radial_2108_134027"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="matrix(-506.669 -75.7783 81.7419 -546.352 942.944 634.339)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#FCFAFA" />
        <stop
          offset="1"
          stop-color="#FCFAFA"
          stop-opacity="0"
        />
      </radialGradient>
      <clipPath :id="ids.clip0_2108_134027">
        <path
          fill="white"
          d="M926 606C926 625.33 910.33 641 891 641L0 641L5.6038e-05 -8.09535e-05L926 0L926 606Z"
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

// -- IDs dynamiques pour scoper les defs et leurs références --
const uid = Math.random().toString(36).slice(2)
const ids = {
  path_1_inside_1_2108_134027: `path-1-inside-1_2108_134027_${uid}`,
  filter0_f_2108_134027: `filter0_f_2108_134027_${uid}`,
  paint0_radial_2108_134027: `paint0_radial_2108_134027_${uid}`,
  clip0_2108_134027: `clip0_2108_134027_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[GlowTopRightSharp.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
