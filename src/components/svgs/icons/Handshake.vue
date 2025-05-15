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
      d="M32.7501 50.4714L38.5835 56.3047C39.158 56.8792 39.8401 57.335 40.5907 57.6459C41.3414 57.9568 42.1459 58.1169 42.9585 58.1169C43.771 58.1169 44.5755 57.9568 45.3262 57.6459C46.0769 57.335 46.7589 56.8792 47.3335 56.3047C47.908 55.7302 48.3637 55.0481 48.6747 54.2974C48.9856 53.5468 49.1456 52.7422 49.1456 51.9297C49.1456 51.1172 48.9856 50.3126 48.6747 49.562C48.3637 48.8113 47.908 48.1292 47.3335 47.5547"
    />
    <path
      stroke="#FCFAFA"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2.5"
      d="M41.4998 41.7215L48.7914 49.0132C49.9518 50.1735 51.5255 50.8254 53.1664 50.8254C54.8074 50.8254 56.3811 50.1735 57.5414 49.0132C58.7018 47.8529 59.3536 46.2791 59.3536 44.6382C59.3536 42.9972 58.7018 41.4235 57.5414 40.2632L46.2248 28.9465C44.5841 27.3079 42.3602 26.3876 40.0414 26.3876C37.7227 26.3876 35.4987 27.3079 33.8581 28.9465L31.2914 31.5132C30.1311 32.6735 28.5574 33.3254 26.9164 33.3254C25.2755 33.3254 23.7018 32.6735 22.5414 31.5132C21.3811 30.3529 20.7292 28.7791 20.7292 27.1382C20.7292 25.4972 21.3811 23.9235 22.5414 22.7632L30.7373 14.5674C33.398 11.9136 36.8678 10.2231 40.5975 9.76352C44.3271 9.30392 48.1036 10.1014 51.3289 12.0299L52.6998 12.8465C53.9416 13.5961 55.4182 13.856 56.8414 13.5757L61.9164 12.5549"
    />
    <path
      stroke="#FCFAFA"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2.5"
      d="M61.9165 9.63818L64.8332 41.7215H58.9999"
    />
    <path
      stroke="#FCFAFA"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2.5"
      d="M9.41667 9.63818L6.5 41.7215L25.4583 60.6798C26.6187 61.8402 28.1924 62.492 29.8333 62.492C31.4743 62.492 33.048 61.8402 34.2083 60.6798C35.3687 59.5195 36.0205 57.9458 36.0205 56.3048C36.0205 54.6639 35.3687 53.0902 34.2083 51.9298"
    />
    <path
      stroke="#FCFAFA"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2.5"
      d="M9.41675 12.5557H32.7501"
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
    console.warn('[Handshake.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
