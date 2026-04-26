// File: src/utils/amenitiesIcons.ts

//
// Structure des amenities et icônes IndieHost :
// - Catalogue : frontend/src/views/Editor/mocks/amenitiesCatalog.ts (id, name, category, relevance).
// - Résolution : getAmenityIconName(id) infère l’icône par règles ; resolveAmenityIconComponent(id) renvoie le composant Lucide.
// - Utilisation : Amenities.vue (ListingView), AmenitiesPanel (Editor), perks.ts (perks = getAmenityIconName(id) ?? 'star').

import * as LucideIcons from 'lucide-vue-next'

export type AmenityId = string
export type LucideIconName = string
export type AmenityIconInput =
  | AmenityId
  | {
    id?: string | null
    name?: string | null
    description?: string | null
    category?: string | null
  }
  | null
  | undefined

type AmenityIconRule = {
  icon: LucideIconName
  keywords: string[]
}

const AMENITY_ICON_RULES: AmenityIconRule[] = [
  { icon: 'wifi', keywords: ['wifi', 'internet', 'ethernet', 'routeur'] },
  { icon: 'parking-circle', keywords: ['parking', 'stationnement', 'garage'] },
  { icon: 'key-round', keywords: ['arrivee autonome', 'self check', 'smart lock', 'serrure', 'key'] },
  { icon: 'door-open', keywords: ['entree', 'door', 'luggage', 'bagage'] },
  { icon: 'accessibility', keywords: ['step free', 'sans marche', 'plain pied', 'accessible'] },
  { icon: 'umbrella', keywords: ['plage', 'beach'] },
  { icon: 'waves', keywords: ['pool', 'piscine', 'jacuzzi', 'spa', 'lake', 'lac', 'canal', 'kayak'] },
  { icon: 'mountain-snow', keywords: ['ski', 'piste', 'mont blanc'] },
  { icon: 'mountain', keywords: ['mountain', 'montagne'] },
  { icon: 'anchor', keywords: ['boat', 'bateau', 'dock', 'anchor', 'mise a l eau'] },
  { icon: 'building-2', keywords: ['resort', 'complexe hotelier'] },
  { icon: 'utensils-crossed', keywords: ['kitchen', 'cuisine', 'table a manger', 'vaisselle', 'blender', 'rice cooker'] },
  { icon: 'coffee', keywords: ['coffee', 'cafe', 'nespresso'] },
  { icon: 'cup-soda', keywords: ['kettle', 'bouilloire', 'tea', 'the'] },
  { icon: 'croissant', keywords: ['breakfast', 'petit dejeuner', 'bread'] },
  { icon: 'refrigerator', keywords: ['refrigerator', 'fridge', 'frigo', 'congelateur', 'freezer'] },
  { icon: 'microwave', keywords: ['microwave', 'micro ondes'] },
  { icon: 'flame', keywords: ['barbecue', 'grill', 'plancha', 'oven', 'four', 'stove', 'cuisiniere', 'toaster', 'sauna', 'fire'] },
  { icon: 'bath', keywords: ['baignoire', 'bathtub', 'bidet', 'bath'] },
  { icon: 'droplets', keywords: ['eau chaude', 'hot water', 'dishwasher', 'lave vaisselle'] },
  { icon: 'shower-head', keywords: ['shower', 'douche'] },
  { icon: 'wind', keywords: ['dryer', 'seche', 'hair dryer'] },
  { icon: 'thermometer-snowflake', keywords: ['climatisation', 'air conditioning'] },
  { icon: 'radiation', keywords: ['heating', 'chauffage', 'heater', 'radiateur'] },
  { icon: 'fan', keywords: ['fan', 'ventilateur'] },
  { icon: 'bed-double', keywords: ['linge', 'linens', 'pillows', 'couvertures'] },
  { icon: 'shirt', keywords: ['washer', 'lave linge', 'iron', 'cintres', 'hangers', 'laundromat'] },
  { icon: 'baby', keywords: ['baby', 'bebe', 'crib', 'chaise haute', 'table a langer'] },
  { icon: 'shield', keywords: ['safety', 'gate', 'guards', 'protection', 'moustiquaire'] },
  { icon: 'gamepad-2', keywords: ['arcade', 'console', 'laser', 'play area'] },
  { icon: 'dice-5', keywords: ['games', 'jeux', 'billard', 'bowling', 'ping pong', 'minigolf'] },
  { icon: 'music', keywords: ['piano', 'audio', 'speaker', 'tourne disque'] },
  { icon: 'tv', keywords: ['tv', 'television', 'cable'] },
  { icon: 'dumbbell', keywords: ['fitness', 'exercise', 'sport', 'gym', 'escalade'] },
  { icon: 'tree-pine', keywords: ['garden', 'jardin'] },
  { icon: 'sun', keywords: ['sun', 'transat', 'chaises longues', 'beach essentials'] },
  { icon: 'moon-star', keywords: ['hammock', 'hamac'] },
  { icon: 'briefcase', keywords: ['briefcase', 'bagages'] },
  { icon: 'lock', keywords: ['safe', 'coffre fort'] },
  { icon: 'plug-zap', keywords: ['electric vehicle', 'vehicules electriques', 'ev charger'] },
  { icon: 'plug', keywords: ['prises', 'outlet'] },
  { icon: 'calendar-range', keywords: ['long term', 'longue duree'] },
  { icon: 'heart-pulse', keywords: ['first aid', 'premiers secours'] },
  { icon: 'alert-triangle', keywords: ['smoke', 'fumee'] },
  { icon: 'alert-octagon', keywords: ['monoxide', 'monoxyde'] },
  { icon: 'fire-extinguisher', keywords: ['extincteur'] },
  { icon: 'spray-can', keywords: ['nettoyage', 'cleaning'] },
  { icon: 'package-check', keywords: ['essentials', 'produits de base'] },
  { icon: 'palette', keywords: ['theme', 'thematique', 'palette'] },
  { icon: 'book-open-text', keywords: ['library', 'livres', 'books'] },
  { icon: 'map', keywords: ['guide', 'map'] },
  { icon: 'map-pin', keywords: ['nature', 'voisinage'] },
  { icon: 'trash-2', keywords: ['trash', 'dechets'] },
  { icon: 'bike', keywords: ['velo', 'bike', 'bicycle'] },
  { icon: 'circle-dot', keywords: ['table tennis', 'ping pong', 'pool table', 'bowling', 'minigolf'] },
  { icon: 'sofa', keywords: ['lounge', 'salon'] },
  { icon: 'move-vertical', keywords: ['elevator', 'ascenseur', 'lift', 'monte charge'] },
]

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

function normalizeIconText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getAmenityIconContext(input: AmenityIconInput) {
  if (typeof input === 'string') {
    return {
      id: input,
      name: '',
      description: '',
      category: '',
    }
  }

  return {
    id: input?.id ?? '',
    name: input?.name ?? '',
    description: input?.description ?? '',
    category: input?.category ?? '',
  }
}

function inferAmenityIconName(input: AmenityIconInput): LucideIconName | null {
  const context = getAmenityIconContext(input)
  const haystack = normalizeIconText(
    `${context.id} ${context.name} ${context.description} ${context.category}`,
  )

  if (!haystack) return null

  for (const rule of AMENITY_ICON_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(normalizeIconText(keyword)))) {
      return rule.icon
    }
  }

  return null
}

export function getAmenityIconName(input: AmenityIconInput): LucideIconName | null {
  return inferAmenityIconName(input)
}

export function resolveAmenityIconComponent(input: AmenityIconInput) {
  return resolveLucideComponent(getAmenityIconName(input))
}
