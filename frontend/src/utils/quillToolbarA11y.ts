import type Quill from 'quill'

type QuillToolbarTitleLabels = {
  style: string
  text: string
  title: string
  bold: string
  italic: string
  link: string
  bulletList: string
}

const DEFAULT_LABELS: QuillToolbarTitleLabels = {
  style: 'Style de texte',
  text: 'Texte',
  title: 'Titre',
  bold: 'Gras',
  italic: 'Italique',
  link: 'Insérer un lien',
  bulletList: 'Liste à puces',
}

function setTooltip(element: Element | null, label: string) {
  if (!(element instanceof HTMLElement)) return
  element.setAttribute('title', label)
  if (!element.getAttribute('aria-label')) {
    element.setAttribute('aria-label', label)
  }
}

export function applyQuillToolbarTitles(
  quill: Quill | null | undefined,
  labels: Partial<QuillToolbarTitleLabels> = {},
) {
  if (!quill) return

  const merged = { ...DEFAULT_LABELS, ...labels }
  const container = quill.root.closest('.ql-container')
  const toolbar =
    container?.parentElement?.querySelector<HTMLElement>('.ql-toolbar') ??
    container?.previousElementSibling

  if (!(toolbar instanceof HTMLElement)) return

  setTooltip(toolbar.querySelector('.ql-header .ql-picker-label'), merged.style)
  setTooltip(toolbar.querySelector('.ql-header .ql-picker-item[data-value=\"2\"]'), merged.title)
  setTooltip(toolbar.querySelector('.ql-header .ql-picker-item[data-value=\"false\"]'), merged.text)
  setTooltip(toolbar.querySelector('.ql-bold'), merged.bold)
  setTooltip(toolbar.querySelector('.ql-italic'), merged.italic)
  setTooltip(toolbar.querySelector('.ql-link'), merged.link)
  setTooltip(toolbar.querySelector('.ql-list[value=\"bullet\"]'), merged.bulletList)
}
