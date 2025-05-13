<template>
  <svg
    :role="role"
    :aria-hidden="role ? undefined : true"
    :aria-labelledby="`titleId descId`"
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
