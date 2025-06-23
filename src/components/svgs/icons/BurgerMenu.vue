<!-- File: src/components/svgs/icons/BurgerMenu.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 36 29"
  >
    <g clip-path="url(#clip0_348_9223)">
      <rect
        width="28"
        height="3"
        x="8"
        y="0.5"
        fill="#111117"
        rx="1.5"
      />
      <rect
        width="36"
        height="3"
        y="13"
        fill="#111117"
        rx="1.5"
      />
      <rect
        width="36"
        height="3"
        y="25.5"
        fill="#111117"
        rx="1.5"
      />
    </g>
    <defs>
      <clipPath id="clip0_348_9223">
        <rect
          width="36"
          height="28"
          fill="white"
          transform="translate(0 0.5)"
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
    console.warn('[BurgerMenu.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
