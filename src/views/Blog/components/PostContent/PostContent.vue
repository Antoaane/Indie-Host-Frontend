<!-- File: src/views/Blog/components/PostContent/PostContent.vue -->

<script setup lang="ts">
interface Props {
  content?: any
}

const props = defineProps<Props>()

/**
 * Convertit un noeud Lexical en HTML
 */
function renderNode(node: any): string {
  if (!node) return ''

  // Gestion des noeuds de type texte
  if (node.type === 'text') {
    let text = node.text || ''

    // Appliquer les styles inline
    if (node.format) {
      if (node.format & 1) text = `<strong>${text}</strong>` // Bold
      if (node.format & 2) text = `<em>${text}</em>` // Italic
      if (node.format & 4) text = `<s>${text}</s>` // Strikethrough
      if (node.format & 8) text = `<u>${text}</u>` // Underline
      if (node.format & 16) text = `<code>${text}</code>` // Code
      if (node.format & 32) text = `<sub>${text}</sub>` // Subscript
      if (node.format & 64) text = `<sup>${text}</sup>` // Superscript
    }

    return text
  }

  // Gestion des paragraphes
  if (node.type === 'paragraph') {
    const children = node.children?.map(renderNode).join('') || ''
    return `<p>${children}</p>`
  }

  // Gestion des titres
  if (node.type === 'heading') {
    const level = node.tag || 'h2'
    const children = node.children?.map(renderNode).join('') || ''
    return `<${level}>${children}</${level}>`
  }

  // Gestion des listes
  if (node.type === 'list') {
    const tag = node.listType === 'number' ? 'ol' : 'ul'
    const children = node.children?.map(renderNode).join('') || ''
    return `<${tag}>${children}</${tag}>`
  }

  if (node.type === 'listitem') {
    const children = node.children?.map(renderNode).join('') || ''
    return `<li>${children}</li>`
  }

  // Gestion des liens
  if (node.type === 'link') {
    const url = node.url || '#'
    const children = node.children?.map(renderNode).join('') || ''
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${children}</a>`
  }

  // Gestion des citations
  if (node.type === 'quote') {
    const children = node.children?.map(renderNode).join('') || ''
    return `<blockquote>${children}</blockquote>`
  }

  // Gestion des blocs de code
  if (node.type === 'code') {
    const children = node.children?.map(renderNode).join('') || ''
    return `<pre><code>${children}</code></pre>`
  }

  // Gestion de la racine
  if (node.type === 'root') {
    return node.children?.map(renderNode).join('') || ''
  }

  // Par défaut, traiter les enfants
  if (node.children) {
    return node.children.map(renderNode).join('')
  }

  return ''
}

/**
 * Convertit le contenu Payload (Lexical) en HTML
 */
function renderContent(content: any): string {
  if (!content) return ''

  // Si le contenu est déjà une string HTML
  if (typeof content === 'string') {
    return content
  }

  // Si le contenu est un objet Lexical
  if (content.root) {
    return renderNode(content.root)
  }

  // Si c'est directement un noeud
  return renderNode(content)
}
</script>

<template>
  <div
    v-if="content"
    class="post-content"
  >
    <div
      class="post-content__body"
      v-html="renderContent(content)"
    />
  </div>
</template>

<style lang="scss" src="./PostContent.scss"></style>
