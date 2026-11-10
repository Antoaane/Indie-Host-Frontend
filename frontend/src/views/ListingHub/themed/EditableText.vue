<!-- File: src/views/ListingHub/themed/EditableText.vue -->
<!-- Texte de la page, modifiable sur place quand la page est en mode édition : on clique, on tape,
     on sort du champ (ou Entrée) et c'est enregistré. Texte brut uniquement, jamais de mise en forme. -->

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** Balise rendue (`h1`, `h2`, `p`…) : le texte garde sa place et son style dans la page. */
    tag?: string
    editing?: boolean
    /** Nom du champ, lu par les lecteurs d'écran et affiché quand le texte est vide. */
    label: string
    /** Plusieurs lignes : Entrée insère un saut de ligne au lieu de valider. */
    multiline?: boolean
    maxLength?: number
  }>(),
  {
    tag: 'p',
    editing: false,
    multiline: false,
    maxLength: 2000,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const element = ref<HTMLElement | null>(null)

function normalize(raw: string): string {
  const text = raw.replace(/ /g, ' ')
  const cleaned = props.multiline
    ? text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    : text.replace(/\s+/g, ' ')
  return cleaned.trim().slice(0, props.maxLength)
}

// Le contenu est posé à la main : Vue ne doit pas réécrire le nœud pendant que l'hôte tape dedans.
function render() {
  if (!element.value) return
  if (document.activeElement === element.value) return
  element.value.textContent = props.modelValue
}

function commit() {
  if (!element.value) return
  const next = normalize(element.value.innerText ?? '')
  element.value.textContent = next
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function onKeydown(event: KeyboardEvent) {
  if (!props.editing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (element.value) element.value.textContent = props.modelValue
    element.value?.blur()
    return
  }
  if (event.key === 'Enter' && !props.multiline) {
    event.preventDefault()
    element.value?.blur()
  }
}

// Collage : uniquement le texte, sans la mise en forme de la source.
function onPaste(event: ClipboardEvent) {
  if (!props.editing) return
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return
  const range = selection.getRangeAt(0)
  range.deleteContents()
  range.insertNode(document.createTextNode(props.multiline ? text : text.replace(/\s+/g, ' ')))
  selection.collapseToEnd()
}

onMounted(render)
watch(() => props.modelValue, render)
watch(() => props.editing, render)
</script>

<template>
  <component
    :is="tag"
    ref="element"
    class="editable-text"
    :class="{ 'is-editable': editing, 'is-multiline': multiline }"
    :contenteditable="editing ? 'plaintext-only' : undefined"
    :role="editing ? 'textbox' : undefined"
    :aria-label="editing ? label : undefined"
    :aria-multiline="editing ? multiline : undefined"
    :data-placeholder="label"
    :spellcheck="editing"
    @blur="commit"
    @keydown="onKeydown"
    @paste="onPaste"
  />
</template>
