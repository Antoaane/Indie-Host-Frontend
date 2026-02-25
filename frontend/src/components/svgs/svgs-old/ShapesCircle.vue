<!-- File: src/components/svgs/images/ShapesCircle.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    viewBox="1645.25 2.5 1716.43 1647"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clip-path="url(#clipCircle)">
      <path
        filter="url(#grainCircle)"
        d="M2503.47 2.5C2977.47 2.5 3361.68 371.213 3361.68 826C3361.68 1280.79 2977.47 1649.5 2503.47 1649.5C2029.47 1649.5 1645.25 1280.79 1645.25 826C1645.25 371.213 2029.47 2.50019 2503.47 2.5Z"
        fill="url(#gradCircle)"
        stroke="none"
      />
      <path
        opacity="0.5"
        d="M2503.47 2.5C2977.47 2.5 3361.68 371.213 3361.68 826C3361.68 1280.79 2977.47 1649.5 2503.47 1649.5C2029.47 1649.5 1645.25 1280.79 1645.25 826C1645.25 371.213 2029.47 2.50019 2503.47 2.5Z"
        fill="url(#gradCircle)"
        stroke="none"
      />
      <path
        d="M2503.47 2.5C2977.47 2.5 3361.68 371.213 3361.68 826C3361.68 1280.79 2977.47 1649.5 2503.47 1649.5C2029.47 1649.5 1645.25 1280.79 1645.25 826C1645.25 371.213 2029.47 2.50019 2503.47 2.5Z"
        fill="none"
        stroke="#FCFAFA"
      />
    </g>

    <defs>
      <!-- Grain -->
      <filter
        id="grainCircle"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.75"
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
        id="gradCircle"
        x1="2503.47"
        y1="2"
        x2="2503.47"
        y2="1650"
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

      <!-- Clip exactly the circle’s box -->
      <clipPath id="clipCircle">
        <rect
          x="1645.25"
          y="2.5"
          width="1716.43"
          height="1647"
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
  if (props.role !== true && (!props.title || !props.desc)) console.warn('[ShapesCircle.vue] title et desc sont requis quand role ≠ true')
})
</script>
