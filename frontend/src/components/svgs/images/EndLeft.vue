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
      :id="ids.path_1_inside_1_1964_130864"
      fill="white"
    >
      <path d="M0 75.0001C0 33.5787 33.5786 0 75 0H926.52V641.471H0V75.0001Z" />
    </mask>
    <path
      :fill="url(ids.paint0_radial_1964_130864)"
      d="M-0.75 75C-0.75 33.1644 33.1644 -0.75 75 -0.75H926.52V0.75H75C33.9929 0.75 0.75 33.9929 0.75 75H-0.75ZM926.52 642.221H-0.75L0.75 640.721H926.52V642.221ZM-0.75 642.221V75C-0.75 33.1644 33.1644 -0.75 75 -0.75V0.75C33.9929 0.75 0.75 33.9929 0.75 75V640.721L-0.75 642.221ZM926.52 0V641.471V0Z"
      :mask="url(ids.path_1_inside_1_1964_130864)"
    />
    <defs>
      <radialGradient
        :id="ids.paint0_radial_1964_130864"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(-16.9531 6.66605) rotate(8.50766) scale(512.594 552.838)"
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
  path_1_inside_1_1964_130864: `path-1-inside-1_1964_130864_${uid}`,
  paint0_radial_1964_130864: `paint0_radial_1964_130864_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[EndLeft.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
