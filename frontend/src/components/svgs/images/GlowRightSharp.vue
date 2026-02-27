<!-- File: src/components/svgs/images/GlowRightSharp.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 926 641"
  >
    <g :clip-path="url(ids.clip0_2108_134032)">
      <mask
        :id="ids.path_1_inside_1_2108_134032"
        fill="white"
      >
        <path d="M0 0H891C910.33 0 926 15.67 926 35V606C926 625.33 910.33 641 891 641H0V0Z" />
      </mask>
      <g
        :filter="url(ids.filter0_f_2108_134032)"
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
        :filter="url(ids.filter1_f_2108_134032)"
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
      :fill="url(ids.paint0_radial_2108_134032)"
      d="M-1 -0.75H891C910.744 -0.75 926.75 15.2558 926.75 35H925.25C925.25 16.0842 909.916 0.75 891 0.75H1L-1 -0.75ZM926.75 606C926.75 625.744 910.744 641.75 891 641.75H-1L1 640.25H891C909.916 640.25 925.25 624.916 925.25 606H926.75ZM-1 641.75V-0.75L1 0.75V640.25L-1 641.75ZM891 -0.75C910.744 -0.75 926.75 15.2558 926.75 35V606C926.75 625.744 910.744 641.75 891 641.75V640.25C909.916 640.25 925.25 624.916 925.25 606V35C925.25 16.0842 909.916 0.75 891 0.75V-0.75Z"
      :mask="url(ids.path_1_inside_1_2108_134032)"
    />
    <path
      :fill="url(ids.paint1_radial_2108_134032)"
      d="M-1 -0.75H891C910.744 -0.75 926.75 15.2558 926.75 35H925.25C925.25 16.0842 909.916 0.75 891 0.75H1L-1 -0.75ZM926.75 606C926.75 625.744 910.744 641.75 891 641.75H-1L1 640.25H891C909.916 640.25 925.25 624.916 925.25 606H926.75ZM-1 641.75V-0.75L1 0.75V640.25L-1 641.75ZM891 -0.75C910.744 -0.75 926.75 15.2558 926.75 35V606C926.75 625.744 910.744 641.75 891 641.75V640.25C909.916 640.25 925.25 624.916 925.25 606V35C925.25 16.0842 909.916 0.75 891 0.75V-0.75Z"
      :mask="url(ids.path_1_inside_1_2108_134032)"
    />
    <defs>
      <filter
        :id="ids.filter0_f_2108_134032"
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
          result="effect1_foregroundBlur_2108_134032"
          stdDeviation="100"
        />
      </filter>
      <filter
        :id="ids.filter1_f_2108_134032"
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
          result="effect1_foregroundBlur_2108_134032"
          stdDeviation="100"
        />
      </filter>
      <radialGradient
        :id="ids.paint0_radial_2108_134032"
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
        :id="ids.paint1_radial_2108_134032"
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
      <clipPath :id="ids.clip0_2108_134032">
        <path
          fill="white"
          d="M0 0H891C910.33 0 926 15.67 926 35V606C926 625.33 910.33 641 891 641H0V0Z"
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
  path_1_inside_1_2108_134032: `path-1-inside-1_2108_134032_${uid}`,
  filter0_f_2108_134032: `filter0_f_2108_134032_${uid}`,
  filter1_f_2108_134032: `filter1_f_2108_134032_${uid}`,
  paint0_radial_2108_134032: `paint0_radial_2108_134032_${uid}`,
  paint1_radial_2108_134032: `paint1_radial_2108_134032_${uid}`,
  clip0_2108_134032: `clip0_2108_134032_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[GlowRightSharp.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
