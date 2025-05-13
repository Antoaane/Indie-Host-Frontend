<template>
  <svg
    :role="role"
    :aria-hidden="role ? undefined : true"
    :aria-labelledby="`titleId descId`"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 50 50"
  >
    <ellipse
      cx="24.9999"
      cy="13.8129"
      fill="url(#paint0_linear_579_13709)"
      rx="7.00979"
      ry="6.72368"
    />
    <path
      fill="url(#paint1_linear_579_13709)"
      d="M24.9999 20.5366L13.8415 42.9107H36.1584L24.9999 20.5366Z"
    />
    <defs>
      <linearGradient
        id="paint0_linear_579_13709"
        x1="24.9999"
        x2="24.9999"
        y1="7.08923"
        y2="20.5366"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0.484"
          stop-color="#FCFAFA"
        />
        <stop
          offset="1"
          stop-color="#FCFAFA"
          stop-opacity="0"
        />
      </linearGradient>
      <linearGradient
        id="paint1_linear_579_13709"
        x1="24.9999"
        x2="24.9999"
        y1="20.5366"
        y2="42.9107"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0.684"
          stop-color="#FCFAFA"
        />
        <stop
          offset="1"
          stop-color="#FCFAFA"
          stop-opacity="0"
        />
      </linearGradient>
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
