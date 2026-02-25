// File: src/utils/i18n.ts

const pluralPattern = /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\s*\}/g

export function formatICUMessage(template: string, values: Record<string, number>): string {
  if (!template) return ''
  return template.replace(pluralPattern, (_match, varName: string, one: string, other: string) => {
    const rawValue = values[varName]
    const value = typeof rawValue === 'number' ? rawValue : 0
    const selection = value === 1 ? one : other
    return selection.replace(/#/g, String(value))
  })
}
