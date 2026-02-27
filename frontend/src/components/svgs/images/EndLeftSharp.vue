<!-- File: src/components/svgs/images/EndLeftSharp.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 928 642"
  >
    <mask
      :id="ids.path_1_inside_1_2012_117555"
      fill="white"
    >
      <path d="M0.830078 25C0.830078 11.1929 12.023 0 25.8301 0H927.35V641.471H0.830078V25Z" />
    </mask>
    <path
      :fill="url(ids.paint0_radial_2012_117555)"
      d="M0.0800781 25C0.0800781 10.7787 11.6087 -0.75 25.8301 -0.75H927.35V0.75H25.8301C12.4372 0.75 1.58008 11.6071 1.58008 25H0.0800781ZM927.35 642.221H0.0800781L1.58008 640.721H927.35V642.221ZM0.0800781 642.221V25C0.0800781 10.7787 11.6087 -0.75 25.8301 -0.75V0.75C12.4372 0.75 1.58008 11.6071 1.58008 25V640.721L0.0800781 642.221ZM927.35 0V641.471V0Z"
      :mask="url(ids.path_1_inside_1_2012_117555)"
    />
    <defs>
      <radialGradient
        :id="ids.paint0_radial_2012_117555"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(-16.123 6.66605) rotate(8.50766) scale(512.594 552.838)"
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
  path_1_inside_1_2012_117555: `path-1-inside-1_2012_117555_${uid}`,
  paint0_radial_2012_117555: `paint0_radial_2012_117555_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[EndLeftSharp.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
