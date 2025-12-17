import amenitiesIcons from '@/content/fr/amenities-icons.json'
import * as LucideIcons from 'lucide-vue-next'

export type AmenityId = string
export type LucideIconName = string

export function toPascalCase(name: string): string {
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

export function resolveLucideComponent(iconName: string | null | undefined) {
  if (!iconName) return null
  const key = toPascalCase(iconName)
  return (LucideIcons as Record<string, any>)[key] ?? null
}

export function getAmenityIconName(amenityId: AmenityId): LucideIconName | null {
  const icon = (amenitiesIcons as Record<string, string | undefined>)[amenityId]
  return icon ?? null
}

export function resolveAmenityIconComponent(amenityId: AmenityId) {
  return resolveLucideComponent(getAmenityIconName(amenityId))
}

