<!-- File: src/components/svgs/images/GlowRight.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 926 641"
  >
    <g :clip-path="url(ids.clip0_2105_134008)">
      <mask
        :id="ids.path_1_inside_1_2105_134008"
        fill="white"
      >
        <path d="M0 0H851C892.421 0 926 33.5786 926 75V566C926 607.421 892.421 641 851 641H0V0Z" />
      </mask>
      <g
        :filter="url(ids.filter0_f_2105_134008)"
        opacity="0.2"
      >
        <ellipse
          cx="926"
          cy="0.5"
          fill="#FCFAFA"
          rx="121"
          ry="77.5"
        />
      </g>
      <g
        :filter="url(ids.filter1_f_2105_134008)"
        opacity="0.2"
      >
        <circle
          cx="926.5"
          cy="641.5"
          r="77.5"
          fill="#FCFAFA"
        />
      </g>
    </g>
    <path
      :fill="url(ids.paint0_radial_2105_134008)"
      d="M-1 -0.75H851C892.836 -0.75 926.75 33.1644 926.75 75H925.25C925.25 33.9929 892.007 0.75 851 0.75H1L-1 -0.75ZM926.75 566C926.75 607.836 892.836 641.75 851 641.75H-1L1 640.25H851C892.007 640.25 925.25 607.007 925.25 566H926.75ZM-1 641.75V-0.75L1 0.75V640.25L-1 641.75ZM851 -0.75C892.836 -0.75 926.75 33.1644 926.75 75V566C926.75 607.836 892.836 641.75 851 641.75V640.25C892.007 640.25 925.25 607.007 925.25 566V75C925.25 33.9929 892.007 0.75 851 0.75V-0.75Z"
      :mask="url(ids.path_1_inside_1_2105_134008)"
    />
    <path
      :fill="url(ids.paint1_radial_2105_134008)"
      d="M-1 -0.75H851C892.836 -0.75 926.75 33.1644 926.75 75H925.25C925.25 33.9929 892.007 0.75 851 0.75H1L-1 -0.75ZM926.75 566C926.75 607.836 892.836 641.75 851 641.75H-1L1 640.25H851C892.007 640.25 925.25 607.007 925.25 566H926.75ZM-1 641.75V-0.75L1 0.75V640.25L-1 641.75ZM851 -0.75C892.836 -0.75 926.75 33.1644 926.75 75V566C926.75 607.836 892.836 641.75 851 641.75V640.25C892.007 640.25 925.25 607.007 925.25 566V75C925.25 33.9929 892.007 0.75 851 0.75V-0.75Z"
      :mask="url(ids.path_1_inside_1_2105_134008)"
    />
    <defs>
      <filter
        :id="ids.filter0_f_2105_134008"
        width="642"
        height="555"
        x="605"
        y="-277"
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
          result="effect1_foregroundBlur_2105_134008"
          stdDeviation="100"
        />
      </filter>
      <filter
        :id="ids.filter1_f_2105_134008"
        width="555"
        height="555"
        x="649"
        y="364"
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
          result="effect1_foregroundBlur_2105_134008"
          stdDeviation="100"
        />
      </filter>
      <radialGradient
        :id="ids.paint0_radial_2105_134008"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="matrix(13.4924 414.695 -663.34 21.5748 899.995 8.72974e-06)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#FCFAFA" />
        <stop
          offset="1"
          stop-color="#FCFAFA"
          stop-opacity="0"
        />
      </radialGradient>
      <radialGradient
        :id="ids.paint1_radial_2105_134008"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="matrix(-258.355 166.877 -132.627 -205.259 926.48 613.049)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#FCFAFA" />
        <stop
          offset="1"
          stop-color="#FCFAFA"
          stop-opacity="0"
        />
      </radialGradient>
      <clipPath :id="ids.clip0_2105_134008">
        <path
          fill="white"
          d="M0 0H851C892.421 0 926 33.5786 926 75V566C926 607.421 892.421 641 851 641H0V0Z"
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
  path_1_inside_1_2105_134008: `path-1-inside-1_2105_134008_${uid}`,
  filter0_f_2105_134008: `filter0_f_2105_134008_${uid}`,
  filter1_f_2105_134008: `filter1_f_2105_134008_${uid}`,
  paint0_radial_2105_134008: `paint0_radial_2105_134008_${uid}`,
  paint1_radial_2105_134008: `paint1_radial_2105_134008_${uid}`,
  clip0_2105_134008: `clip0_2105_134008_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[GlowRight.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
