<!-- File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalPanels.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import type { RawArrival, RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

import ArrivalIntroPanel from '@/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalIntroPanel.vue'
import ArrivalSectionPanel from '@/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalSectionPanel.vue'
import ArrivalHtmlPanel from '@/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalHtmlPanel.vue'
import ArrivalGuidePanel from '@/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalGuidePanel.vue'

const props = defineProps<{
  core?: Partial<RawCore> | null
  arrival?: Partial<RawArrival> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const panelContent = editorStatic.panels.arrival

const preciseAddress = computed(() => String(props.core?.precise_address ?? '').trim())

const accessValues = computed(() => {
  const base = (props.arrival?.practical?.access ?? {}) as Record<string, string>
  if (!preciseAddress.value) return base
  return {
    ...base,
    address: preciseAddress.value,
  }
})
</script>

<template>
  <div class="editor-arrival-panels">
    <ArrivalIntroPanel
      :arrival="props.arrival"
      @patch="emit('patch', $event)"
    />
    <ArrivalSectionPanel
      section-key="savings"
      :title="panelContent.practical.savings.title"
      :subtitle="panelContent.practical.savings.subtitle"
      :fields="panelContent.practical.savings.fields"
      :values="props.arrival?.practical?.savings"
      @patch="emit('patch', $event)"
    />
    <ArrivalSectionPanel
      section-key="access"
      :title="panelContent.practical.access.title"
      :subtitle="panelContent.practical.access.subtitle"
      :fields="panelContent.practical.access.fields"
      :values="accessValues"
      :locked-field-keys="['address']"
      :locked-field-hint="panelContent.practical.access.addressLockedHint"
      @patch="emit('patch', $event)"
    />
    <ArrivalSectionPanel
      section-key="services"
      :title="panelContent.practical.services.title"
      :subtitle="panelContent.practical.services.subtitle"
      :fields="panelContent.practical.services.fields"
      :values="props.arrival?.practical?.services"
      @patch="emit('patch', $event)"
    />
    <ArrivalHtmlPanel
      section-key="rules"
      :title="panelContent.practical.rules.title"
      :subtitle="panelContent.practical.rules.subtitle"
      :label="panelContent.practical.rules.label"
      :placeholder="panelContent.practical.rules.placeholder"
      :value="props.arrival?.practical?.rules"
      @patch="emit('patch', $event)"
    />
    <ArrivalHtmlPanel
      section-key="shops"
      :title="panelContent.practical.shops.title"
      :subtitle="panelContent.practical.shops.subtitle"
      :label="panelContent.practical.shops.label"
      :placeholder="panelContent.practical.shops.placeholder"
      :value="props.arrival?.practical?.shops"
      @patch="emit('patch', $event)"
    />
    <ArrivalGuidePanel
      :arrival="props.arrival"
      @patch="emit('patch', $event)"
    />
  </div>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-arrival-panels {
  @extend %panels-stack;
}
</style>
