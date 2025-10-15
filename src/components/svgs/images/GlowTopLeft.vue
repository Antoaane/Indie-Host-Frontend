<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 926 641"
  >
    <g :clip-path="url(ids.clip0_2105_134015)">
      <mask
        :id="ids.path_1_inside_1_2105_134015"
        fill="white"
      >
        <path d="M6.55671e-06 566C2.93554e-06 607.421 33.5786 641 75 641L926 641L926 1.99183e-05L5.6038e-05 -6.10352e-05L6.55671e-06 566Z" />
      </mask>
      <g
        :filter="url(ids.filter0_f_2105_134015)"
        opacity="0.2"
      >
        <ellipse
          cx="83"
          cy="112.5"
          fill="#FCFAFA"
          rx="83"
          ry="112.5"
          transform="matrix(1 8.74228e-08 8.74228e-08 -1 -83.1699 753)"
        />
      </g>
    </g>
    <path
      :fill="url(ids.paint0_radial_2105_134015)"
      d="M-0.749993 566C-0.749997 607.836 33.1644 641.75 75 641.75L926 641.75L926 640.25L75 640.25C33.9929 640.25 0.750003 607.007 0.750007 566L-0.749993 566ZM926 1.99183e-05L5.6038e-05 -6.10352e-05L926 1.99183e-05ZM-0.749944 -6.11007e-05L-0.749993 566C-0.749997 607.836 33.1644 641.75 75 641.75L75 640.25C33.9929 640.25 0.750003 607.007 0.750007 566L0.750056 -6.09696e-05L-0.749944 -6.11007e-05ZM926 641L926 1.99183e-05L926 641Z"
      :mask="url(ids.path_1_inside_1_2105_134015)"
    />
    <defs>
      <filter
        :id="ids.filter0_f_2105_134015"
        width="566"
        height="625"
        x="-283.17"
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
          result="effect1_foregroundBlur_2105_134015"
          stdDeviation="100"
        />
      </filter>
      <radialGradient
        :id="ids.paint0_radial_2105_134015"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="matrix(506.669 -75.7782 -81.7418 -546.353 -16.9436 634.339)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#FCFAFA" />
        <stop
          offset="1"
          stop-color="#FCFAFA"
          stop-opacity="0"
        />
      </radialGradient>
      <clipPath :id="ids.clip0_2105_134015">
        <path
          fill="white"
          d="M6.55671e-06 566C2.93554e-06 607.421 33.5786 641 75 641L926 641L926 1.99183e-05L5.6038e-05 -6.10352e-05L6.55671e-06 566Z"
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
  path_1_inside_1_2105_134015: `path-1-inside-1_2105_134015_${uid}`,
  filter0_f_2105_134015: `filter0_f_2105_134015_${uid}`,
  paint0_radial_2105_134015: `paint0_radial_2105_134015_${uid}`,
  clip0_2105_134015: `clip0_2105_134015_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[GlowTopLeft.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
