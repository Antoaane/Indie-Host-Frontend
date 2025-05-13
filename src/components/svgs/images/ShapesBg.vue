<template>
  <svg
    :role="role"
    :aria-hidden="role ? undefined : true"
    :aria-labelledby="`titleId descId`"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 3363 1651"
  >
    <g opacity="0.05">
      <path
        fill="url(#paint0_linear_913_13889)"
        stroke="#FCFAFA"
        d="M822.875 2.01822L1 1649.98H1644.75L822.875 2.01822Z"
      />
      <path
        fill="url(#paint1_linear_913_13889)"
        stroke="#FCFAFA"
        d="M2503.47 2.5C2977.47 2.5 3361.68 371.213 3361.68 826C3361.68 1280.79 2977.47 1649.5 2503.47 1649.5C2029.47 1649.5 1645.25 1280.79 1645.25 826C1645.25 371.213 2029.47 2.50019 2503.47 2.5Z"
      />
    </g>
    <defs>
      <linearGradient
        id="paint0_linear_913_13889"
        x1="822.875"
        x2="822.875"
        y1="2.01822"
        y2="1649.98"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0.339"
          stop-color="white"
          stop-opacity="0"
        />
        <stop
          offset="0.679"
          stop-color="white"
          stop-opacity="0.5"
        />
        <stop
          offset="1"
          stop-color="white"
          stop-opacity="0"
        />
      </linearGradient>
      <linearGradient
        id="paint1_linear_913_13889"
        x1="2503.47"
        x2="2503.47"
        y1="2"
        y2="1650"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          stop-color="white"
          stop-opacity="0.75"
        />
        <stop
          offset="0.5"
          stop-color="white"
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
