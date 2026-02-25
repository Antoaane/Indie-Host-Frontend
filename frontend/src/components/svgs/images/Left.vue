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
      :id="ids.path_1_inside_1_1964_130866"
      fill="white"
    >
      <path d="M0 75.0001C0 33.5787 33.5786 0 75 0H926.52V641.471H75C33.5787 641.471 0 607.893 0 566.471V75.0001Z" />
    </mask>
    <path
      :fill="url(ids.paint0_radial_1964_130866)"
      d="M-0.75 75C-0.75 33.1644 33.1644 -0.75 75 -0.75H926.52V0.75H75C33.9929 0.75 0.75 33.9929 0.75 75H-0.75ZM926.52 642.221H75C33.1644 642.221 -0.75 608.307 -0.75 566.471H0.75C0.75 607.479 33.9929 640.721 75 640.721H926.52V642.221ZM75 642.221C33.1644 642.221 -0.75 608.307 -0.75 566.471V75C-0.75 33.1644 33.1644 -0.75 75 -0.75V0.75C33.9929 0.75 0.75 33.9929 0.75 75V566.471C0.75 607.479 33.9929 640.721 75 640.721V642.221ZM926.52 0V641.471V0Z"
      :mask="url(ids.path_1_inside_1_1964_130866)"
    />
    <path
      :fill="url(ids.paint1_radial_1964_130866)"
      d="M-0.75 75C-0.75 33.1644 33.1644 -0.75 75 -0.75H926.52V0.75H75C33.9929 0.75 0.75 33.9929 0.75 75H-0.75ZM926.52 642.221H75C33.1644 642.221 -0.75 608.307 -0.75 566.471H0.75C0.75 607.479 33.9929 640.721 75 640.721H926.52V642.221ZM75 642.221C33.1644 642.221 -0.75 608.307 -0.75 566.471V75C-0.75 33.1644 33.1644 -0.75 75 -0.75V0.75C33.9929 0.75 0.75 33.9929 0.75 75V566.471C0.75 607.479 33.9929 640.721 75 640.721V642.221ZM926.52 0V641.471V0Z"
      :mask="url(ids.path_1_inside_1_1964_130866)"
    />
    <path
      :fill="url(ids.paint2_radial_1964_130866)"
      d="M-0.75 75C-0.75 33.1644 33.1644 -0.75 75 -0.75H926.52V0.75H75C33.9929 0.75 0.75 33.9929 0.75 75H-0.75ZM926.52 642.221H75C33.1644 642.221 -0.75 608.307 -0.75 566.471H0.75C0.75 607.479 33.9929 640.721 75 640.721H926.52V642.221ZM75 642.221C33.1644 642.221 -0.75 608.307 -0.75 566.471V75C-0.75 33.1644 33.1644 -0.75 75 -0.75V0.75C33.9929 0.75 0.75 33.9929 0.75 75V566.471C0.75 607.479 33.9929 640.721 75 640.721V642.221ZM926.52 0V641.471V0Z"
      :mask="url(ids.path_1_inside_1_1964_130866)"
    />
    <defs>
      <radialGradient
        :id="ids.paint0_radial_1964_130866"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(21 627) rotate(1.17299) scale(150.632 227.184)"
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
        :id="ids.paint1_radial_1964_130866"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(-16.9531 6.66604) rotate(3.64438) scale(335.632 427.391)"
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
        :id="ids.paint2_radial_1964_130866"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(56 -3.35154e-05) rotate(16.1276) scale(216.001 345.451)"
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
  path_1_inside_1_1964_130866: `path-1-inside-1_1964_130866_${uid}`,
  paint0_radial_1964_130866: `paint0_radial_1964_130866_${uid}`,
  paint1_radial_1964_130866: `paint1_radial_1964_130866_${uid}`,
  paint2_radial_1964_130866: `paint2_radial_1964_130866_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[Left.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
