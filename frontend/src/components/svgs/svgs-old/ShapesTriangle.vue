<!-- File: src/components/svgs/svgs-old/ShapesTriangle.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    viewBox="1 2.01822 1643.75 1647.96178"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clip-path="url(#clipTriangle)">
      <path
        filter="url(#grainTriangle)"
        d="M822.875 2.01822L1 1649.98H1644.75L822.875 2.01822Z"
        fill="url(#gradTriangle)"
        stroke="none"
      />
      <path
        opacity="0.5"
        d="M822.875 2.01822L1 1649.98H1644.75L822.875 2.01822Z"
        fill="url(#gradTriangle)"
        stroke="none"
      />
      <path
        d="M822.875 2.01822L1 1649.98H1644.75L822.875 2.01822Z"
        fill="none"
        stroke="#FCFAFA"
      />
    </g>

    <defs>
      <!-- Grain -->
      <filter
        id="grainTriangle"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.45"
          numOctaves="2"
          result="noise"
        />
        <feColorMatrix
          in="noise"
          type="saturate"
          values="0"
          result="grayscale"
        />
        <feComponentTransfer
          in="grayscale"
          result="grain"
        >
          <feFuncA
            type="discrete"
            tableValues="1 0"
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

      <!-- Gradient -->
      <linearGradient
        id="gradTriangle"
        x1="822.875"
        y1="2.01822"
        x2="822.875"
        y2="1649.98"
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

      <!-- Clip exactly the triangle’s box -->
      <clipPath id="clipTriangle">
        <rect
          x="1"
          y="2.01822"
          width="1643.75"
          height="1647.96178"
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
const props = withDefaults(defineProps<{ title?: string; desc?: string; role?: boolean | string }>(), { role: true })
const attrRole = computed(() => (props.role === true ? undefined : String(props.role)))
const ariaHidden = computed(() => props.role === true)
const ariaLabelledBy = computed(() => (props.role === true ? undefined : 'titleId descId'))
onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) console.warn('[ShapesTriangle.vue] title et desc sont requis quand role ≠ true')
})
</script>
