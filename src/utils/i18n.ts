// File: src/utils/i18n.ts

const boldPattern = /\[b](.*?)\[\/b]/gis
const italicPattern = /\[i](.*?)\[\/i]/gis
const linkPattern = /\[link\s+url="([^"]+)"\](.*?)\[\/link]/gis
const pluralPattern = /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\s*\}/g

export function formatRichText(value?: string | null): string {
  if (!value) return ''
  let output = value
  output = output.replace(boldPattern, '<strong>$1</strong>')
  output = output.replace(italicPattern, '<em>$1</em>')
  output = output.replace(
    linkPattern,
    (_, url: string, label: string) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  )
  output = output.replace(/\n{2,}/g, '<br /><br />')
  output = output.replace(/\n/g, '<br />')
  return output
}

export function formatICUMessage(template: string, values: Record<string, number>): string {
  if (!template) return ''
  return template.replace(pluralPattern, (_match, varName: string, one: string, other: string) => {
    const rawValue = values[varName]
    const value = typeof rawValue === 'number' ? rawValue : 0
    const selection = value === 1 ? one : other
    return selection.replace(/#/g, String(value))
  })
}
