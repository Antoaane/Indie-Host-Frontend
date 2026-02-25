<template>
  <svg
    :role="attrRole"
    :aria-hidden="ariaHidden"
    :aria-labelledby="ariaLabelledBy"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 928 642"
  >
    <mask
      :id="ids.path_1_inside_1_2012_117556"
      fill="white"
    >
      <path d="M0.830078 0H902.35C916.157 0 927.35 11.1929 927.35 25V616.471C927.35 630.279 916.157 641.471 902.35 641.471H0.830078V0Z" />
    </mask>
    <path
      :fill="url(ids.paint0_radial_2012_117556)"
      d="M0.830078 -0.75H902.35C916.571 -0.75 928.1 10.7787 928.1 25H926.6C926.6 11.6071 915.743 0.75 902.35 0.75H0.830078V-0.75ZM928.1 616.471C928.1 630.693 916.571 642.221 902.35 642.221H0.830078V640.721H902.35C915.743 640.721 926.6 629.864 926.6 616.471H928.1ZM0.830078 641.471V0V641.471ZM902.35 -0.75C916.571 -0.75 928.1 10.7787 928.1 25V616.471C928.1 630.693 916.571 642.221 902.35 642.221V640.721C915.743 640.721 926.6 629.864 926.6 616.471V25C926.6 11.6071 915.743 0.75 902.35 0.75V-0.75Z"
      :mask="url(ids.path_1_inside_1_2012_117556)"
    />
    <path
      :fill="url(ids.paint1_radial_2012_117556)"
      d="M0.830078 -0.75H902.35C916.571 -0.75 928.1 10.7787 928.1 25H926.6C926.6 11.6071 915.743 0.75 902.35 0.75H0.830078V-0.75ZM928.1 616.471C928.1 630.693 916.571 642.221 902.35 642.221H0.830078V640.721H902.35C915.743 640.721 926.6 629.864 926.6 616.471H928.1ZM0.830078 641.471V0V641.471ZM902.35 -0.75C916.571 -0.75 928.1 10.7787 928.1 25V616.471C928.1 630.693 916.571 642.221 902.35 642.221V640.721C915.743 640.721 926.6 629.864 926.6 616.471V25C926.6 11.6071 915.743 0.75 902.35 0.75V-0.75Z"
      :mask="url(ids.path_1_inside_1_2012_117556)"
    />
    <defs>
      <radialGradient
        :id="ids.paint0_radial_2012_117556"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(927.83 613.5) rotate(147.136) scale(307.752 244.546)"
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
        :id="ids.paint1_radial_2012_117556"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="translate(901.33 8.73616e-06) rotate(88.1368) scale(415.22 664.064)"
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
  path_1_inside_1_2012_117556: `path-1-inside-1_2012_117556_${uid}`,
  paint0_radial_2012_117556: `paint0_radial_2012_117556_${uid}`,
  paint1_radial_2012_117556: `paint1_radial_2012_117556_${uid}`,
} as Record<string, string>
const url = (v: string) => `url(#${v})`

onMounted(() => {
  if (props.role !== true && (!props.title || !props.desc)) {
    console.warn('[RightSharp.vue] title et desc sont requis quand role ≠ true')
  }
})
// généré automatiquement par convert_svg.py
</script>
