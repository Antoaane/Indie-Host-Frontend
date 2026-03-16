<!-- File: src/views/CreateListing/components/panels/CreateWizardStepShell.vue -->

<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  hint?: string | null
  validationError?: string | null
  fillHeight?: boolean
  fitWidth?: boolean
}>(), {
  fillHeight: true,
  fitWidth: false,
})
</script>

<template>
  <section
    class="create-wizard-step-shell"
    :class="{
      'is-auto-height': !props.fillHeight,
      'is-fit-width': props.fitWidth,
    }"
  >
    <div class="header">
      <h2>{{ props.title }}</h2>
      <h3 v-if="props.hint">
        {{ props.hint }}
      </h3>
    </div>

    <div class="content">
      <slot />
    </div>

    <p
      v-if="props.validationError"
      class="error"
    >
      {{ props.validationError }}
    </p>
  </section>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/create-wizard-step-shell.scss */

@use '@/styles/variables/globals' as *;
@use '@/views/CreateListing/components/panels/panel.scss' as *;

.create-wizard-step-shell {
  @extend %panel;

  width: 100%;
  display: flex;
  flex-direction: column;

  &.is-fit-width {
    width: auto;
    max-width: 100%;
    flex: 0 1 auto;
  }

  &:not(.is-auto-height) {
    height: auto;
    flex: 1 1 auto;
    min-height: 0;
  }

  &.is-fit-width:not(.is-auto-height) {
    flex: 0 1 auto;
  }

  > .header {
    @extend %panel-header;
    margin-bottom: var(--layout-gap-sm);
  }

  > .content {
    @extend %panel-body;
    min-width: 0;
  }

  &.is-fit-width > .content {
    width: auto;
    max-width: 100%;
  }

  &:not(.is-auto-height) > .content {
    flex: 1 1 auto;
    min-height: 0;
  }

  &:not(.is-auto-height) > .content {
    > [class*='create-'][class$='-panel'],
    > [class*='editor-'][class$='-panel'] {
      height: 100%;
      flex: 1 1 auto;
      min-height: 0;
      border: none;
      box-shadow: none;
      background: transparent;
      padding: 0;

      > .header {
        display: none;
      }

      > .body {
        padding: 0;
      }
    }
  }

  &.is-fit-width > .content {
    > [class*='create-'][class$='-panel'],
    > [class*='editor-'][class$='-panel'] {
      width: auto;
      max-width: 100%;
    }
  }

  &.is-auto-height > .content {
    flex: 0 0 auto;
    min-height: auto;

    > [class*='create-'][class$='-panel'],
    > [class*='editor-'][class$='-panel'] {
      height: auto;
      flex: 0 0 auto;
      min-height: auto;
      border: none;
      box-shadow: none;
      background: transparent;
      padding: 0;

      > .header {
        display: none;
      }

      > .body {
        padding: 0;
      }
    }
  }

  > .error {
    margin: var(--layout-gap-sm) 0 0 0;
    color: rgba($bad, 0.95);
    @include little-text($thin: false);
  }
}
</style>
