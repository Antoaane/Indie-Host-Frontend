// File: src/utils/amenitiesIcons.ts

//
// Structure des amenities et icônes IndieHost :
// - Catalogue : frontend/src/views/Editor/mocks/amenitiesCatalog.ts (id, name, category, relevance).
// - Résolution : getAmenityIconName(id) infère l’icône par règles ; resolveAmenityIconComponent(id) renvoie le composant Lucide.
// - Utilisation : Amenities.vue (ListingView), AmenitiesPanel (Editor), perks.ts (perks = getAmenityIconName(id) ?? 'star').

import * as LucideIcons from '@lucide/vue'

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

// Ordre : du plus précis au plus général, la première règle qui reconnaît le nom l'emporte. Un
// mot-clé de trois lettres ou moins doit être un mot entier (« spa », « fan », « the », « key » se
// retrouvaient dans « espace », « enfants », « bibliothèque », « hockey ») ; les autres se lisent en
// début de mot (« velo » reconnaît « vélos », « door » ne reconnaît plus « outdoor »).
const AMENITY_ICON_RULES: AmenityIconRule[] = [
  { icon: 'wifi', keywords: ['wifi', 'internet', 'ethernet', 'routeur'] },
  { icon: 'laptop', keywords: ['workspace', 'espace de travail', 'bureau'] },
  { icon: 'plug-zap', keywords: ['electric vehicle', 'vehicules electriques', 'ev charger', 'recharge'] },
  { icon: 'parking-circle', keywords: ['parking', 'stationnement', 'garage'] },
  { icon: 'key-round', keywords: ['arrivee autonome', 'self check', 'smart lock', 'serrure', 'key'] },
  { icon: 'accessibility', keywords: ['step free', 'sans marche', 'plain pied', 'accessible'] },
  { icon: 'train-front', keywords: ['metro', 'train', 'gare', 'tram'] },
  { icon: 'move-vertical', keywords: ['elevator', 'ascenseur', 'lift', 'monte charge'] },
  // Sécurité avant « flame » (« fire extinguisher ») et « grill » (« grilles de fenêtre »).
  { icon: 'fire-extinguisher', keywords: ['fire extinguisher', 'extincteur'] },
  { icon: 'alert-triangle', keywords: ['smoke', 'fumee'] },
  { icon: 'alert-octagon', keywords: ['monoxide', 'monoxyde'] },
  { icon: 'heart-pulse', keywords: ['first aid', 'premiers secours', 'kit de secours'] },
  { icon: 'baby', keywords: ['baby', 'bebe', 'crib', 'chaise haute', 'table a langer'] },
  { icon: 'shield', keywords: ['safety', 'gate', 'guards', 'grilles de fenetre', 'protection', 'moustiquaire'] },
  { icon: 'plug', keywords: ['prises', 'outlet'] },
  { icon: 'lock', keywords: ['safe', 'coffre fort'] },
  // Jeux avant « waves » (« pool table ») et « mountain-snow » (« piste de bowling »).
  { icon: 'gamepad-2', keywords: ['arcade', 'console', 'laser', 'play area'] },
  { icon: 'dice-5', keywords: ['games', 'jeux', 'billard', 'pool table', 'bowling', 'ping pong', 'table tennis', 'minigolf'] },
  { icon: 'dumbbell', keywords: ['fitness', 'exercise', 'sport', 'gym', 'escalade'] },
  { icon: 'bike', keywords: ['velo', 'bike', 'bicycle'] },
  { icon: 'book-open-text', keywords: ['library', 'bibliotheque', 'livres', 'books'] },
  { icon: 'music', keywords: ['piano', 'audio', 'speaker', 'enceinte', 'tourne disque'] },
  { icon: 'tv', keywords: ['tv', 'television', 'cable'] },
  // Extérieur et vues.
  { icon: 'umbrella', keywords: ['plage', 'beach'] },
  { icon: 'shower-head', keywords: ['shower', 'douche'] },
  { icon: 'waves', keywords: ['pool', 'piscine', 'jacuzzi', 'spa', 'lake', 'lac', 'canal', 'kayak'] },
  { icon: 'mountain-snow', keywords: ['ski', 'piste', 'mont blanc'] },
  { icon: 'mountain', keywords: ['mountain', 'montagne'] },
  { icon: 'anchor', keywords: ['boat', 'bateau', 'dock', 'anchor', 'mise a l eau'] },
  { icon: 'building-2', keywords: ['resort', 'complexe hotelier'] },
  { icon: 'tree-pine', keywords: ['garden', 'jardin'] },
  { icon: 'moon-star', keywords: ['hammock', 'hamac'] },
  { icon: 'sun', keywords: ['sun', 'transat', 'chaises longues', 'terrace', 'terrasse', 'balcon', 'patio'] },
  // Cuisine : les appareils avant la règle générale.
  { icon: 'coffee', keywords: ['coffee', 'cafe', 'nespresso'] },
  { icon: 'cup-soda', keywords: ['kettle', 'bouilloire', 'tea', 'the'] },
  { icon: 'croissant', keywords: ['breakfast', 'petit dejeuner', 'bread'] },
  { icon: 'refrigerator', keywords: ['refrigerator', 'refrigerateur', 'fridge', 'frigo', 'congelateur', 'freezer'] },
  { icon: 'microwave', keywords: ['microwave', 'micro ondes'] },
  { icon: 'droplets', keywords: ['eau chaude', 'hot water', 'dishwasher', 'lave vaisselle'] },
  { icon: 'flame', keywords: ['barbecue', 'grill', 'plancha', 'oven', 'four', 'stove', 'plaques', 'cuisiniere', 'toaster', 'grille pain', 'sauna', 'fire', 'cheminee'] },
  { icon: 'utensils-crossed', keywords: ['kitchen', 'cuisine', 'dining', 'espace repas', 'table a manger', 'vaisselle', 'blender', 'rice cooker', 'cuiseur', 'verres'] },
  // Salle de bain, linge, confort.
  { icon: 'bath', keywords: ['baignoire', 'bathtub', 'bidet', 'bath'] },
  // Lave-linge et sèche-linge avant « linge » (linge de lit) et « seche » (sèche-cheveux).
  { icon: 'washing-machine', keywords: ['washer', 'lave linge', 'seche linge', 'machine a laver', 'laundromat', 'laverie'] },
  { icon: 'wind', keywords: ['dryer', 'seche', 'hair dryer'] },
  { icon: 'shirt', keywords: ['iron', 'fer a repasser', 'cintres', 'hangers'] },
  { icon: 'thermometer-snowflake', keywords: ['climatisation', 'air conditioning'] },
  { icon: 'radiation', keywords: ['heating', 'chauffage', 'heater', 'radiateur'] },
  { icon: 'fan', keywords: ['fan', 'ventilateur'] },
  { icon: 'blinds', keywords: ['curtains', 'rideaux', 'volets', 'stores'] },
  { icon: 'bed-double', keywords: ['linge', 'linens', 'pillows', 'oreillers', 'couvertures'] },
  { icon: 'sofa', keywords: ['lounge', 'salon'] },
  { icon: 'door-open', keywords: ['entree', 'door', 'luggage', 'bagage'] },
  { icon: 'briefcase', keywords: ['briefcase'] },
  // Divers.
  { icon: 'calendar-range', keywords: ['long term', 'longue duree'] },
  { icon: 'spray-can', keywords: ['nettoyage', 'cleaning', 'menage'] },
  { icon: 'package-check', keywords: ['essentials', 'produits de base', 'equipements de base'] },
  { icon: 'palette', keywords: ['theme', 'thematique', 'palette'] },
  { icon: 'map', keywords: ['guide', 'map'] },
  { icon: 'map-pin', keywords: ['nature', 'voisinage'] },
  { icon: 'trash-2', keywords: ['trash', 'dechets'] }
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

  // Le nom d'abord ; la catégorie seulement s'il ne dit rien. Cherchés ensemble, « Cuisine &
  // boissons » donnait l'icône de la cuisine au réfrigérateur comme au four. La description ne sert
  // plus : un « four » qui y était cité donnait une flamme à la cuisine équipée.
  return matchAmenityIconRule(normalizeIconText(`${context.id} ${context.name}`))
    ?? matchAmenityIconRule(normalizeIconText(context.category))
}

function keywordMatches(paddedHaystack: string, keyword: string): boolean {
  const normalized = normalizeIconText(keyword)
  if (!normalized) return false
  // Trois lettres ou moins : mot entier. Au-delà : en début de mot.
  if (normalized.length <= 3) return paddedHaystack.includes(` ${normalized} `)
  return paddedHaystack.includes(` ${normalized}`)
}

function matchAmenityIconRule(haystack: string): LucideIconName | null {
  if (!haystack) return null

  const padded = ` ${haystack} `
  for (const rule of AMENITY_ICON_RULES) {
    if (rule.keywords.some((keyword) => keywordMatches(padded, keyword))) {
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
