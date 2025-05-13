<template>
  <svg
    :role="role"
    :aria-hidden="role ? undefined : true"
    :aria-labelledby="`titleId descId`"
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
    <title :id="`titleId`">{{ title }}</title>
    <desc :id="`descId`">{{ desc }}</desc>
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  desc: string
  role?: string
}>()
// généré automatiquement par convert_svg.py
</script>
