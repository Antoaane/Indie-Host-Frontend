<!-- File: src/views/CreateListing/components/panels/CreateWizardStepShell.vue -->

<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  hint?: string | null
  validationError?: string | null
  fitWidth?: boolean
}>(), {
  fitWidth: false,
})
</script>

<template>
  <section
    class="create-wizard-step-shell"
    :class="{
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
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &.is-fit-width {
    width: auto;
    max-width: 100%;
    flex: 0 1 auto;
  }

  > .header {
    @extend %panel-header;
    margin-bottom: var(--layout-gap-sm);
  }

  > .content {
    @extend %panel-body;
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  &.is-fit-width > .content {
    width: auto;
    max-width: 100%;
  }

  > .content {
    > * {
      min-width: 0;
    }

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

  > .error {
    margin: var(--layout-gap-sm) 0 0 0;
    color: rgba($bad, 0.95);
    @include little-text($thin: false);
  }
}
</style>
