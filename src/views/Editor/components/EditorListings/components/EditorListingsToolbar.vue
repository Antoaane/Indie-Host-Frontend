<!-- File: src/views/Editor/components/EditorListings/components/EditorListingsToolbar.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { Search } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  placeholder: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const queryModel = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})
</script>

<template>
  <div class="toolbar">
    <div class="search">
      <Search
        class="icon"
        :size="20"
      />
      <input
        v-model="queryModel"
        type="search"
        :placeholder="props.placeholder"
      />
    </div>
  </div>
</template>
