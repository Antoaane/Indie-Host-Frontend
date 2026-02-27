<!-- File: src/components/svgs/svgs-old/Left.vue -->

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
      id="path-1-inside-1_1964_130866"
      fill="white"
    >
      <path d="M0 50.0001C0 22.3858 22.3858 0 50 0H926.52V641.471H50C22.3858 641.471 0 619.086 0 591.471V50.0001Z" />
    </mask>
    <path
      fill="url(#paint0_radial_1964_130866)"
      d="M-0.75 50C-0.75 21.9715 21.9715 -0.75 50 -0.75H926.52V0.75H50C22.8 0.75 0.75 22.8 0.75 50H-0.75ZM926.52 642.221H50C21.9715 642.221 -0.75 619.5 -0.75 591.471H0.75C0.75 618.672 22.8 640.721 50 640.721H926.52V642.221ZM50 642.221C21.9715 642.221 -0.75 619.5 -0.75 591.471V50C-0.75 21.9715 21.9715 -0.75 50 -0.75V0.75C22.8 0.75 0.75 22.8 0.75 50V591.471C0.75 618.672 22.8 640.721 50 640.721V642.221ZM926.52 0V641.471V0Z"
      mask="url(#path-1-inside-1_1964_130866)"
    />
    <path
      fill="url(#paint1_radial_1964_130866)"
      d="M-0.75 50C-0.75 21.9715 21.9715 -0.75 50 -0.75H926.52V0.75H50C22.8 0.75 0.75 22.8 0.75 50H-0.75ZM926.52 642.221H50C21.9715 642.221 -0.75 619.5 -0.75 591.471H0.75C0.75 618.672 22.8 640.721 50 640.721H926.52V642.221ZM50 642.221C21.9715 642.221 -0.75 619.5 -0.75 591.471V50C-0.75 21.9715 21.9715 -0.75 50 -0.75V0.75C22.8 0.75 0.75 22.8 0.75 50V591.471C0.75 618.672 22.8 640.721 50 640.721V642.221ZM926.52 0V641.471V0Z"
      mask="url(#path-1-inside-1_1964_130866)"
    />
    <path
      fill="url(#paint2_radial_1964_130866)"
      d="M-0.75 50C-0.75 21.9715 21.9715 -0.75 50 -0.75H926.52V0.75H50C22.8 0.75 0.75 22.8 0.75 50H-0.75ZM926.52 642.221H50C21.9715 642.221 -0.75 619.5 -0.75 591.471H0.75C0.75 618.672 22.8 640.721 50 640.721H926.52V642.221ZM50 642.221C21.9715 642.221 -0.75 619.5 -0.75 591.471V50C-0.75 21.9715 21.9715 -0.75 50 -0.75V0.75C22.8 0.75 0.75 22.8 0.75 50V591.471C0.75 618.672 22.8 640.721 50 640.721V642.221ZM926.52 0V641.471V0Z"
      mask="url(#path-1-inside-1_1964_130866)"
    />
    <defs>
      <radialGradient
        id="paint0_radial_1964_130866"
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
        id="paint1_radial_1964_130866"
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
        id="paint2_radial_1964_130866"
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

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[Left.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
