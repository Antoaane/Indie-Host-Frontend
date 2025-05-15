<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 71 71"
  >
    <path
      stroke="#FCFAFA"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2.5"
      d="M47.7 23.522L42.4383 39.3041C42.152 40.1633 41.6695 40.944 41.0291 41.5844C40.3887 42.2248 39.608 42.7073 38.7488 42.9936L22.9667 48.2553L28.2283 32.4732C28.5147 31.614 28.9972 30.8333 29.6376 30.1929C30.278 29.5525 31.0587 29.07 31.9179 28.7836L47.7 23.522Z"
    />
    <path
      stroke="#FCFAFA"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2.5"
      d="M35.3333 65.0555C51.4416 65.0555 64.5 51.9971 64.5 35.8888C64.5 19.7805 51.4416 6.72217 35.3333 6.72217C19.225 6.72217 6.16666 19.7805 6.16666 35.8888C6.16666 51.9971 19.225 65.0555 35.3333 65.0555Z"
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
    console.warn('[Compass.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
