<!-- File: src/components/svgs/icons/FrenchFlag.vue -->

<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 60 40"
  >
    <rect
      width="20"
      height="40"
      x="0"
      y="0"
      fill="#0055A4"
    />
    <rect
      width="20"
      height="40"
      x="20"
      y="0"
      fill="#FFFFFF"
    />
    <rect
      width="20"
      height="40"
      x="40"
      y="0"
      fill="#EF4135"
    />
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
    console.warn('[FrenchFlag.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
