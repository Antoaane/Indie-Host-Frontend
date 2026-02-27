<!-- File: src/components/svgs/svgs-old/ShapesBgCroped.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 1920 1390"
  >
    <g clip-path="url(#clip0_519_14128)">
      <g>
        <path
          fill="url(#paint0_linear_519_14128)"
          stroke="none"
          d="M80.8745 -260.982L-741 1386.98H902.749L80.8745 -260.982Z"
          filter="url(#grain)"
        />
        <path
          fill="url(#paint0_linear_519_14128)"
          stroke="none"
          d="M80.8745 -260.982L-741 1386.98H902.749L80.8745 -260.982Z"
          opacity="0.5"
        />
        <path
          fill="none"
          stroke="#FCFAFA"
          d="M80.8745 -260.982L-741 1386.98H902.749L80.8745 -260.982Z"
        />
        <path
          fill="url(#paint1_linear_519_14128)"
          stroke="none"
          d="M1761.47 -260.5C2235.47 -260.5 2619.68 108.213 2619.68 563C2619.68 1017.79 2235.47 1386.5 1761.47 1386.5C1287.47 1386.5 903.249 1017.79 903.249 563C903.249 108.213 1287.47 -260.5 1761.47 -260.5Z"
          filter="url(#grain)"
        />
        <path
          fill="url(#paint1_linear_519_14128)"
          stroke="none"
          d="M1761.47 -260.5C2235.47 -260.5 2619.68 108.213 2619.68 563C2619.68 1017.79 2235.47 1386.5 1761.47 1386.5C1287.47 1386.5 903.249 1017.79 903.249 563C903.249 108.213 1287.47 -260.5 1761.47 -260.5Z"
          opacity="0.5"
        />
        <path
          fill="none"
          stroke="#FCFAFA"
          d="M1761.47 -260.5C2235.47 -260.5 2619.68 108.213 2619.68 563C2619.68 1017.79 2235.47 1386.5 1761.47 1386.5C1287.47 1386.5 903.249 1017.79 903.249 563C903.249 108.213 1287.47 -260.5 1761.47 -260.5Z"
        />
      </g>
    </g>
    <defs>
      <filter
        id="grain"
        filterUnits="userSpaceOnUse"
      >
        <feTurbulence
          baseFrequency="0.45"
          numOctaves="2"
          result="noise"
          type="fractalNoise"
        />
        <feColorMatrix
          in="noise"
          result="grayscale"
          type="saturate"
          values="0"
        />
        <feComponentTransfer
          in="grayscale"
          result="grain"
        >
          <feFuncA
            tableValues="1 0"
            type="discrete"
          />
        </feComponentTransfer>
        <feComposite
          in="grain"
          in2="SourceAlpha"
          operator="in"
          result="maskedGrain"
        />
        <feMerge><feMergeNode in="maskedGrain" /></feMerge>
      </filter>
      <linearGradient
        id="paint0_linear_519_14128"
        x1="80.8745"
        x2="80.8745"
        y1="-260.982"
        y2="1386.98"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0.25"
          stop-color="white"
          stop-opacity="0"
        />
        <stop
          offset="0.75"
          stop-color="white"
          stop-opacity="0.99"
        />
        <stop
          offset="1"
          stop-color="white"
          stop-opacity="0"
        />
      </linearGradient>
      <linearGradient
        id="paint1_linear_519_14128"
        x1="1761.47"
        x2="1761.47"
        y1="-261"
        y2="1387"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          stop-color="white"
          stop-opacity="0.99"
        />
        <stop
          offset="0.6"
          stop-color="white"
          stop-opacity="0"
        />
      </linearGradient>
      <clipPath id="clip0_519_14128">
        <rect
          width="1920"
          height="1390"
          fill="white"
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

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[ShapesBgCroped.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
