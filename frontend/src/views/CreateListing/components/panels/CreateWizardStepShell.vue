<!-- File: src/views/CreateListing/components/panels/CreateWizardStepShell.vue -->

<script setup lang="ts">
const props = defineProps<{
  title: string
  hint?: string | null
  validationError?: string | null
}>()
</script>

<template>
  <section class="create-wizard-step-shell">
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
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;

  > .header {
    @extend %panel-header;
    margin-bottom: var(--layout-gap-sm);
  }

  > .content {
    @extend %panel-body;

    flex: 1 1 auto;
    min-height: 0;

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

  > .error {
    margin: var(--layout-gap-sm) 0 0 0;
    color: rgba($bad, 0.95);
    @include little-text($thin: false);
  }
}
</style>
