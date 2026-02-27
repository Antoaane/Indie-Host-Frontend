<!-- File: src/components/svgs/images/Right.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 927 642"
  >
    <mask
      :id="ids.path_1_inside_1_1964_130865"
      fill="white"
    >
      <path d="M0 0H851.52C892.941 0 926.52 33.5786 926.52 75V566.471C926.52 607.893 892.941 641.471 851.52 641.471H0V0Z" />
    </mask>
    <path
      :fill="url(ids.paint0_radial_1964_130865)"
      d="M0 -0.75H851.52C893.355 -0.75 927.27 33.1644 927.27 75H925.77C925.77 33.9929 892.527 0.75 851.52 0.75H0V-0.75ZM927.27 566.471C927.27 608.307 893.355 642.221 851.52 642.221H0V640.721H851.52C892.527 640.721 925.77 607.479 925.77 566.471H927.27ZM0 641.471V0V641.471ZM851.52 -0.75C893.355 -0.75 927.27 33.1644 927.27 75V566.471C927.27 608.307 893.355 642.221 851.52 642.221V640.721C892.527 640.721 925.77 607.479 925.77 566.471V75C925.77 33.9929 892.527 0.75 851.52 0.75V-0.75Z"
      :mask="url(ids.path_1_inside_1_1964_130865)"
    />
    <path
      :fill="url(ids.paint1_radial_1964_130865)"
      d="M0 -0.75H851.52C893.355 -0.75 927.27 33.1644 927.27 75H925.77C925.77 33.9929 892.527 0.75 851.52 0.75H0V-0.75ZM927.27 566.471C927.27 608.307 893.355 642.221 851.52 642.221H0V640.721H851.52C892.527 640.721 925.77 607.479 925.77 566.471H927.27ZM0 641.471V0V641.471ZM851.52 -0.75C893.355 -0.75 927.27 33.1644 927.27 75V566.471C927.27 608.307 893.355 642.221 851.52 642.221V640.721C892.527 640.721 925.77 607.479 925.77 566.471V75C925.77 33.9929 892.527 0.75 851.52 0.75V-0.75Z"
      :mask="url(ids.path_1_inside_1_1964_130865)"
    />
    <defs>
      <radialGradient
        :id="ids.paint0_radial_1964_130865"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(927 613.5) rotate(147.136) scale(307.752 244.546)"
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
        :id="ids.paint1_radial_1964_130865"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(900.5 8.73616e-06) rotate(88.1368) scale(415.22 664.064)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#FCFAFA" />
        <stop
          offset="1"
          stop-color="#FCFAFA"
          stop-opacity="0"
        />
      </radialGradient>
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
  path_1_inside_1_1964_130865: `path-1-inside-1_1964_130865_${uid}`,
  paint0_radial_1964_130865: `paint0_radial_1964_130865_${uid}`,
  paint1_radial_1964_130865: `paint1_radial_1964_130865_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[Right.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
