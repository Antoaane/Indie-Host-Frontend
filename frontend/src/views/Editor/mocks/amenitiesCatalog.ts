// File: src/views/Editor/mocks/amenitiesCatalog.ts

export type AmenityCatalogItem = {
  id: string
  name: string
  description?: string
  category: string
  relevance: number
  perkEligible?: boolean
  perkScore?: number
  perkPriority?: number
}

export type AmenitiesCatalogResponse = {
  amenities: AmenityCatalogItem[]
}

export const mockAmenitiesCatalog: AmenitiesCatalogResponse = {
  amenities: [
    {
      id: 'WIFI',
      name: 'Wifi',
      description: 'Connexion internet',
      category: 'Confort & travail',
      relevance: 95,
    },
    {
      id: 'DEDICATED_WORKSPACE',
      name: 'Espace de travail dédié',
      description: 'Bureau / table + prise',
      category: 'Confort & travail',
      relevance: 85,
    },
    {
      id: 'REVERSIBLE_AIR_CONDITIONING',
      name: 'Climatisation réversible',
      description: 'Chaud / froid',
      category: 'Confort & travail',
      relevance: 80,
    },
    {
      id: 'PORTABLE_AIR_CONDITIONING',
      name: 'Climatisation mobile',
      description: 'Pour les fortes chaleurs',
      category: 'Confort & travail',
      relevance: 70,
    },
    {
      id: 'SPACE_HEATER',
      name: "Chauffage d'appoint",
      description: 'Convecteurs électriques',
      category: 'Confort & travail',
      relevance: 60,
    },
    {
      id: 'BLACKOUT_CURTAINS',
      name: 'Rideaux occultants',
      description: 'Pour une nuit complète',
      category: 'Confort & travail',
      relevance: 60,
    },
    {
      id: 'LINENS_PROVIDED',
      name: 'Linge de lit et de bain',
      description: 'Draps et serviettes fournis',
      category: 'Confort & travail',
      relevance: 75,
    },
    {
      id: 'HAIR_DRYER',
      name: 'Sèche-cheveux',
      description: 'Dans la salle de bain',
      category: 'Confort & travail',
      relevance: 55,
    },
    {
      id: 'EQUIPPED_KITCHEN',
      name: 'Cuisine équipée',
      description: 'Plaques, four, vaisselle…',
      category: 'Cuisine & boissons',
      relevance: 85,
    },
    {
      id: 'NESPRESSO_COFFEE_MACHINE',
      name: 'Machine à café Nespresso',
      description: 'Capsules incluses',
      category: 'Cuisine & boissons',
      relevance: 70,
    },
    {
      id: 'FILTER_COFFEE_MAKER',
      name: 'Machine à café filtre',
      description: 'Café moulu de bienvenue',
      category: 'Cuisine & boissons',
      relevance: 60,
    },
    {
      id: 'KETTLE_AND_TEA',
      name: 'Bouilloire + thés',
      description: 'Sélection de thés',
      category: 'Cuisine & boissons',
      relevance: 55,
    },
    {
      id: 'OUTDOOR_DINING_AREA',
      name: 'Espace repas extérieur',
      description: 'Table / chaises',
      category: 'Extérieur & détente',
      relevance: 65,
    },
    {
      id: 'WOOD_TERRACE',
      name: 'Terrasse',
      description: 'Espace extérieur aménagé',
      category: 'Extérieur & détente',
      relevance: 70,
    },
    {
      id: 'SUN_LOUNGERS',
      name: 'Chaises longues',
      description: 'Pour se détendre',
      category: 'Extérieur & détente',
      relevance: 60,
    },
    {
      id: 'HAMMOCK',
      name: 'Hamac',
      description: 'Coin détente',
      category: 'Extérieur & détente',
      relevance: 50,
    },
    {
      id: 'ELECTRIC_BARBECUE',
      name: 'Barbecue',
      description: 'Ustensiles fournis',
      category: 'Extérieur & détente',
      relevance: 60,
    },
    {
      id: 'PLANCHA_GRILL',
      name: 'Plancha',
      description: 'Cuisine extérieure',
      category: 'Extérieur & détente',
      relevance: 60,
    },
    {
      id: 'OUTDOOR_SHOWER',
      name: 'Douche extérieure',
      description: 'Retour de plage',
      category: 'Extérieur & détente',
      relevance: 55,
    },
    {
      id: 'HEATED_POOL',
      name: 'Piscine chauffée',
      description: 'En saison',
      category: 'Extérieur & détente',
      relevance: 90,
    },
    {
      id: 'WALK_TO_BEACH',
      name: 'Plage à pied',
      description: 'Accès rapide',
      category: 'Vue & accès',
      relevance: 85,
    },
    {
      id: 'PANORAMIC_LAKE_VIEW',
      name: 'Vue panoramique',
      description: 'Belle vue',
      category: 'Vue & accès',
      relevance: 80,
    },
    {
      id: 'MONT_BLANC_VIEW',
      name: 'Vue Mont-Blanc',
      description: 'Panorama montagnes',
      category: 'Vue & accès',
      relevance: 85,
    },
    {
      id: 'CANAL_VIEW',
      name: 'Vue sur le canal',
      description: 'À deux pas des quais',
      category: 'Vue & accès',
      relevance: 75,
    },
    {
      id: 'EASY_METRO_ACCESS',
      name: 'Accès facile métro',
      description: 'Station à proximité',
      category: 'Arrivée & mobilité',
      relevance: 70,
    },
    {
      id: 'ELEVATOR',
      name: 'Ascenseur',
      description: 'Accès pratique',
      category: 'Arrivée & mobilité',
      relevance: 55,
    },
    {
      id: 'FREE_PARKING_ON_PREMISES',
      name: 'Parking gratuit sur place',
      description: 'Sur place',
      category: 'Arrivée & mobilité',
      relevance: 70,
    },
    {
      id: 'PRIVATE_PARKING',
      name: 'Parking privé',
      description: 'Sur la propriété',
      category: 'Arrivée & mobilité',
      relevance: 70,
    },
    {
      id: 'PARKING_FOR_TWO_CARS',
      name: 'Parking 2 voitures',
      description: 'Sur la propriété',
      category: 'Arrivée & mobilité',
      relevance: 70,
    },
    {
      id: 'SELF_CHECK_IN',
      name: 'Arrivée autonome',
      description: 'Boîte à clés / entrée autonome',
      category: 'Sécurité',
      relevance: 70,
    },
    {
      id: 'SMART_LOCK',
      name: 'Serrure connectée',
      description: 'Entrée autonome',
      category: 'Sécurité',
      relevance: 65,
    },
    {
      id: 'SMOKE_ALARM',
      name: 'Détecteur de fumée',
      description: 'Sécurité',
      category: 'Sécurité',
      relevance: 70,
    },
    {
      id: 'CARBON_MONOXIDE_ALARM',
      name: 'Détecteur monoxyde',
      description: 'Sécurité',
      category: 'Sécurité',
      relevance: 50,
    },
    {
      id: 'FIRST_AID_KIT',
      name: 'Kit de secours',
      description: 'Premiers soins',
      category: 'Sécurité',
      relevance: 60,
    },
    {
      id: 'FIRE_EXTINGUISHER',
      name: 'Extincteur',
      description: 'Accessible',
      category: 'Sécurité',
      relevance: 55,
    },
    {
      id: 'SMART_TV',
      name: 'TV connectée',
      description: 'Netflix / YouTube',
      category: 'Vie à bord',
      relevance: 60,
    },
    {
      id: 'BLUETOOTH_SPEAKER',
      name: 'Enceinte Bluetooth',
      description: 'Pour la musique',
      category: 'Vie à bord',
      relevance: 55,
    },
    {
      id: 'BOARD_GAMES',
      name: 'Jeux de société',
      description: 'Pour les soirées',
      category: 'Vie à bord',
      relevance: 50,
    },
    {
      id: 'MINI_LIBRARY',
      name: 'Mini-bibliothèque',
      description: 'Livres et guides',
      category: 'Vie à bord',
      relevance: 40,
    },
  ],
}
