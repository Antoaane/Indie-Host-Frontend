<!-- File: src/components/svgs/images/GlowTopRight.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 926 641"
  >
    <g :clip-path="url(ids.clip0_2105_134021)">
      <mask
        :id="ids.path_1_inside_1_2105_134021"
        fill="white"
      >
        <path d="M926 566C926 607.421 892.421 641 851 641L0 641L5.6038e-05 -8.09535e-05L926 0L926 566Z" />
      </mask>
      <g
        :filter="url(ids.filter0_f_2105_134021)"
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
      :fill="url(ids.paint0_radial_2105_134021)"
      d="M926.75 566C926.75 607.836 892.836 641.75 851 641.75L-6.55671e-08 641.75L6.55671e-08 640.25L851 640.25C892.007 640.25 925.25 607.007 925.25 566L926.75 566ZM5.6038e-05 -8.09535e-05L926 0L5.6038e-05 -8.09535e-05ZM926.75 6.55671e-08L926.75 566C926.75 607.836 892.836 641.75 851 641.75L851 640.25C892.007 640.25 925.25 607.007 925.25 566L925.25 -6.55671e-08L926.75 6.55671e-08ZM0 641L5.6038e-05 -8.09535e-05L0 641Z"
      :mask="url(ids.path_1_inside_1_2105_134021)"
    />
    <defs>
      <filter
        :id="ids.filter0_f_2105_134021"
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
          result="effect1_foregroundBlur_2105_134021"
          stdDeviation="100"
        />
      </filter>
      <radialGradient
        :id="ids.paint0_radial_2105_134021"
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
      <clipPath :id="ids.clip0_2105_134021">
        <path
          fill="white"
          d="M926 566C926 607.421 892.421 641 851 641L0 641L5.6038e-05 -8.09535e-05L926 0L926 566Z"
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
  path_1_inside_1_2105_134021: `path-1-inside-1_2105_134021_${uid}`,
  filter0_f_2105_134021: `filter0_f_2105_134021_${uid}`,
  paint0_radial_2105_134021: `paint0_radial_2105_134021_${uid}`,
  clip0_2105_134021: `clip0_2105_134021_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[GlowTopRight.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
