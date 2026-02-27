<!-- File: src/components/svgs/images/ShapesBg.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 3363 1651"
  >
    <g :clip-path="url(ids.clip0_913_13889)">
      <g>
        <path
          :fill="url(ids.paint0_linear_913_13889)"
          stroke="none"
          d="M822.875 2.01822L1 1649.98H1644.75L822.875 2.01822Z"
          :filter="url(ids.grain)"
        />
        <path
          :fill="url(ids.paint0_linear_913_13889)"
          stroke="none"
          d="M822.875 2.01822L1 1649.98H1644.75L822.875 2.01822Z"
          opacity="0.5"
        />
        <path
          fill="none"
          stroke="#FCFAFA"
          d="M822.875 2.01822L1 1649.98H1644.75L822.875 2.01822Z"
        />
        <path
          :fill="url(ids.paint1_linear_913_13889)"
          stroke="none"
          d="M2503.47 2.5C2977.47 2.5 3361.68 371.213 3361.68 826C3361.68 1280.79 2977.47 1649.5 2503.47 1649.5C2029.47 1649.5 1645.25 1280.79 1645.25 826C1645.25 371.213 2029.47 2.50019 2503.47 2.5Z"
          :filter="url(ids.grain)"
        />
        <path
          :fill="url(ids.paint1_linear_913_13889)"
          stroke="none"
          d="M2503.47 2.5C2977.47 2.5 3361.68 371.213 3361.68 826C3361.68 1280.79 2977.47 1649.5 2503.47 1649.5C2029.47 1649.5 1645.25 1280.79 1645.25 826C1645.25 371.213 2029.47 2.50019 2503.47 2.5Z"
          opacity="0.5"
        />
        <path
          fill="none"
          stroke="#FCFAFA"
          d="M2503.47 2.5C2977.47 2.5 3361.68 371.213 3361.68 826C3361.68 1280.79 2977.47 1649.5 2503.47 1649.5C2029.47 1649.5 1645.25 1280.79 1645.25 826C1645.25 371.213 2029.47 2.50019 2503.47 2.5Z"
        />
      </g>
    </g>
    <defs>
      <filter
        :id="ids.grain"
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
        :id="ids.paint0_linear_913_13889"
        x1="822.875"
        x2="822.875"
        y1="2.01822"
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
      <linearGradient
        :id="ids.paint1_linear_913_13889"
        x1="2503.47"
        x2="2503.47"
        y1="2"
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
      <clipPath :id="ids.clip0_913_13889">
        <rect
          width="3363"
          height="1651"
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

// -- IDs dynamiques pour scoper les defs et leurs références --
const uid = Math.random().toString(36).slice(2)
const ids = {
  grain: `grain_${uid}`,
  paint0_linear_913_13889: `paint0_linear_913_13889_${uid}`,
  paint1_linear_913_13889: `paint1_linear_913_13889_${uid}`,
  clip0_913_13889: `clip0_913_13889_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[ShapesBg.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
