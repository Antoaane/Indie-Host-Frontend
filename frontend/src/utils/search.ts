// File: src/utils/search.ts

function toSearchInput(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return ''
}

export function normalizeSearchText(value: unknown): string {
  return toSearchInput(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '')
}

export function tokenizeSearchText(value: unknown): string[] {
  return toSearchInput(value)
    .trim()
    .split(/\s+/)
    .map((token) => normalizeSearchText(token))
    .filter(Boolean)
}
