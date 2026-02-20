<!-- File: src/components/layouts/BaseSidebar.vue -->

<script setup lang="ts">
withDefaults(
  defineProps<{
    tag?: string
    bodyScrollable?: boolean
  }>(),
  {
    tag: 'aside',
    bodyScrollable: false,
  },
)
</script>

<template>
  <component
    :is="tag"
    class="base-sidebar"
    :class="{ 'is-body-scrollable': bodyScrollable }"
  >
    <div
      v-if="$slots.header"
      class="base-sidebar__header"
    >
      <slot name="header" />
    </div>

    <div class="base-sidebar__body">
      <slot />
    </div>

    <div
      v-if="$slots.footer"
      class="base-sidebar__footer"
    >
      <slot name="footer" />
    </div>
  </component>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.base-sidebar {
  --sidebar-min-width: 26rem;
  --sidebar-width: 28rem;
  --sidebar-max-width: 32rem;

  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-sm);
  overflow: hidden;
  box-shadow: 0 14px 28px -16px var(--base-sidebar-shadow-color, rgba(15, 23, 42, 0.18));

  > .base-sidebar__header,
  > .base-sidebar__footer {
    flex: 0 0 auto;
    min-width: 0;
  }

  > .base-sidebar__body {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  &.is-body-scrollable {
    > .base-sidebar__body {
      overflow: auto;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }
  }
}

@include min-width(lg) {
  .base-sidebar {
    --sidebar-min-width: 30rem;
    --sidebar-width: 32rem;
    --sidebar-max-width: 35rem;
    width: clamp(var(--sidebar-min-width), var(--sidebar-width), var(--sidebar-max-width));
    min-width: var(--sidebar-min-width);
    max-width: var(--sidebar-max-width);
    flex: 0 0 clamp(var(--sidebar-min-width), var(--sidebar-width), var(--sidebar-max-width));
  }
}

@include min-width(xl) {
  .base-sidebar {
    --sidebar-min-width: 32rem;
    --sidebar-width: 34rem;
    --sidebar-max-width: 36rem;
  }
}

@include min-width(xxl) {
  .base-sidebar {
    --sidebar-min-width: 34rem;
    --sidebar-width: 36rem;
    --sidebar-max-width: 38rem;
  }
}
</style>
