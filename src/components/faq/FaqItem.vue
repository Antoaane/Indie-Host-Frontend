<!-- File: src/components/faq/FaqItem.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import FaqCollapse from '@/components/faq/FaqCollapse.vue'

export interface FaqNode {
  id: string
  title?: string
  question?: string
  answer?: string
  children?: FaqNode[]
}

const props = defineProps<{ node: FaqNode; search?: string }>()
const isCategory = computed(() => !!props.node.children?.length)

function highlight(text?: string) {
  if (!text || !props.search) return text ?? ''
  const escaped = props.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}
</script>

<template>
  <li v-if="isCategory">
    <FaqCollapse>
      <template #summary>
        <h3>{{ node.title }}</h3>
      </template>
      <template #content>
        <ul>
          <FaqItem
            v-for="child in node.children"
            :key="child.id"
            :node="child"
            :search="search"
          />
        </ul>
      </template>
    </FaqCollapse>
  </li>
  <li
    v-else
    itemscope
    itemprop="mainEntity"
    itemtype="https://schema.org/Question"
  >
    <FaqCollapse :question="node.question">
      <template #summary>
        <h4
          itemprop="name"
          v-html="highlight(node.question)"
        />
      </template>
      <template #content>
        <div
          itemscope
          itemprop="acceptedAnswer"
          itemtype="https://schema.org/Answer"
        >
          <p
            itemprop="text"
            v-html="highlight(node.answer)"
          />
        </div>
      </template>
    </FaqCollapse>
  </li>
</template>
