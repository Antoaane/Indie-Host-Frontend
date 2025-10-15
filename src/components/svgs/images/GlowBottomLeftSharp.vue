<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 926 641"
  >
    <g :clip-path="url(ids.clip0_2108_134035)">
      <mask
        :id="ids.path_1_inside_1_2108_134035"
        fill="white"
      >
        <path d="M0 35C0 15.67 15.67 0 35 0H926V641H0V35Z" />
      </mask>
      <g
        :filter="url(ids.filter0_f_2108_134035)"
        opacity="0.2"
      >
        <ellipse
          cx="-0.16993"
          cy="0.5"
          fill="#FCFAFA"
          rx="83"
          ry="112.5"
        />
      </g>
    </g>
    <path
      :fill="url(ids.paint0_radial_2108_134035)"
      d="M-0.75 35C-0.75 15.2558 15.2558 -0.75 35 -0.75H926V0.75H35C16.0842 0.75 0.75 16.0842 0.75 35H-0.75ZM926 641H0H926ZM-0.75 641V35C-0.75 15.2558 15.2558 -0.75 35 -0.75V0.75C16.0842 0.75 0.75 16.0842 0.75 35V641H-0.75ZM926 0V641V0Z"
      :mask="url(ids.path_1_inside_1_2108_134035)"
    />
    <defs>
      <filter
        :id="ids.filter0_f_2108_134035"
        width="566"
        height="625"
        x="-283.17"
        y="-312"
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
          result="effect1_foregroundBlur_2108_134035"
          stdDeviation="100"
        />
      </filter>
      <radialGradient
        :id="ids.paint0_radial_2108_134035"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="matrix(506.669 75.7782 -81.7419 546.352 -16.9436 6.66115)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#FCFAFA" />
        <stop
          offset="1"
          stop-color="#FCFAFA"
          stop-opacity="0"
        />
      </radialGradient>
      <clipPath :id="ids.clip0_2108_134035">
        <path
          fill="white"
          d="M0 35C0 15.67 15.67 0 35 0H926V641H0V35Z"
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
  path_1_inside_1_2108_134035: `path-1-inside-1_2108_134035_${uid}`,
  filter0_f_2108_134035: `filter0_f_2108_134035_${uid}`,
  paint0_radial_2108_134035: `paint0_radial_2108_134035_${uid}`,
  clip0_2108_134035: `clip0_2108_134035_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[GlowBottomLeftSharp.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
