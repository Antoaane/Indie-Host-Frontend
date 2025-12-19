// File: src/services/payloadApi.ts

import type { PayloadArticlesResponse, PayloadArticle } from '@/types/payload'

// URL de base de l'API Payload depuis les variables d'environnement
// En développement, utilise le proxy Vite (localhost) pour éviter les problèmes CORS
// En production, utilise l'URL complète
const PAYLOAD_API_URL = import.meta.env.DEV
  ? '' // Utilise le proxy Vite en dev (pas de préfixe nécessaire)
  : import.meta.env.VITE_PAYLOAD_API_URL

if (!PAYLOAD_API_URL && !import.meta.env.DEV) {
  console.warn('VITE_PAYLOAD_API_URL n\'est pas défini dans les variables d\'environnement')
}

/**
 * Erreur personnalisée pour les requêtes API Payload
 */
export class PayloadApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string
  ) {
    super(message)
    this.name = 'PayloadApiError'
  }
}

/**
 * Récupère le dernier article publié depuis Payload CMS
 * Utilise l'endpoint configuré pour retourner un seul article trié par date décroissante
 *
 * @returns Le dernier article publié ou null si aucun article n'est disponible
 * @throws {PayloadApiError} Si la requête échoue
 */
export async function getLatestPublishedArticle(): Promise<PayloadArticle | null> {
  // En développement, PAYLOAD_API_URL est une chaîne vide (utilise le proxy Vite)
  // En production, on vérifie qu'elle est définie
  if (!import.meta.env.DEV && !PAYLOAD_API_URL) {
    throw new PayloadApiError(
      'L\'URL de l\'API Payload n\'est pas configurée',
      0,
      'Configuration manquante'
    )
  }

  try {
    // Endpoint spécifique pour récupérer le dernier article publié
    // where[status][equals]=published : seulement les articles publiés
    // sort=-publishedDate : tri décroissant par date de publication
    // limit=1 : un seul résultat
    const url = `${PAYLOAD_API_URL}/api/articles?where[status][equals]=published&sort=-publishedDate&limit=1`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new PayloadApiError(
        `Erreur lors de la récupération de l'article: ${response.statusText}`,
        response.status,
        response.statusText
      )
    }

    const data: PayloadArticlesResponse = await response.json()

    // Vérifier si au moins un article est retourné
    if (!data.docs || data.docs.length === 0) {
      return null
    }

    // Retourner le premier (et seul) article
    return data.docs[0]
  } catch (error) {
    // Si c'est déjà une PayloadApiError, la relancer
    if (error instanceof PayloadApiError) {
      throw error
    }

    // Sinon, créer une nouvelle PayloadApiError
    if (error instanceof Error) {
      throw new PayloadApiError(
        `Erreur réseau lors de la récupération de l'article: ${error.message}`,
        0,
        'Erreur réseau'
      )
    }

    // Erreur inconnue
    throw new PayloadApiError(
      'Une erreur inconnue s\'est produite',
      0,
      'Erreur inconnue'
    )
  }
}

/**
 * Récupère tous les articles publiés avec pagination
 *
 * @param page Numéro de page (par défaut 1)
 * @param limit Nombre d'articles par page (par défaut 10)
 * @returns La réponse paginée de l'API Payload
 * @throws {PayloadApiError} Si la requête échoue
 */
export async function getPublishedArticles(
  page: number = 1,
  limit: number = 10
): Promise<PayloadArticlesResponse> {
  // En développement, PAYLOAD_API_URL est une chaîne vide (utilise le proxy Vite)
  // En production, on vérifie qu'elle est définie
  if (!import.meta.env.DEV && !PAYLOAD_API_URL) {
    throw new PayloadApiError(
      'L\'URL de l\'API Payload n\'est pas configurée',
      0,
      'Configuration manquante'
    )
  }

  try {
    const url = `${PAYLOAD_API_URL}/api/articles?sort=-createdAt&limit=${limit}&page=${page}&where[_status][equals]=published`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new PayloadApiError(
        `Erreur lors de la récupération des articles: ${response.statusText}`,
        response.status,
        response.statusText
      )
    }

    const data: PayloadArticlesResponse = await response.json()
    return data
  } catch (error) {
    if (error instanceof PayloadApiError) {
      throw error
    }

    if (error instanceof Error) {
      throw new PayloadApiError(
        `Erreur réseau lors de la récupération des articles: ${error.message}`,
        0,
        'Erreur réseau'
      )
    }

    throw new PayloadApiError(
      'Une erreur inconnue s\'est produite',
      0,
      'Erreur inconnue'
    )
  }
}

/**
 * Récupère les articles épinglés et en sélectionne 4 aléatoirement
 * Filtre uniquement les articles publiés avec pinned=true
 * Exclut automatiquement le dernier article publié (affiché dans BlogHeroSection)
 *
 * @returns Un tableau de 4 articles épinglés sélectionnés aléatoirement (ou moins si pas assez disponibles)
 * @throws {PayloadApiError} Si la requête échoue
 */
export async function getPinnedArticles(): Promise<PayloadArticle[]> {
  if (!import.meta.env.DEV && !PAYLOAD_API_URL) {
    throw new PayloadApiError(
      'L\'URL de l\'API Payload n\'est pas configurée',
      0,
      'Configuration manquante'
    )
  }

  try {
    // Récupérer d'abord le dernier article publié pour l'exclure
    const latestArticle = await getLatestPublishedArticle()
    const latestArticleId = latestArticle?.id

    console.log('🔝 [payloadApi] Dernier article publié (à exclure):', latestArticleId)

    // Récupère TOUS les articles pour filtrage côté client
    const url = `${PAYLOAD_API_URL}/api/articles?limit=100`

    console.log('🌐 [payloadApi] URL de la requête:', url)
    console.log('🔧 [payloadApi] PAYLOAD_API_URL:', PAYLOAD_API_URL)
    console.log('🔧 [payloadApi] DEV mode:', import.meta.env.DEV)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('📡 [payloadApi] Réponse HTTP:', response.status, response.statusText)

    if (!response.ok) {
      throw new PayloadApiError(
        `Erreur lors de la récupération des articles épinglés: ${response.statusText}`,
        response.status,
        response.statusText
      )
    }

    const data: PayloadArticlesResponse = await response.json()

    console.log('📦 [payloadApi] Données brutes reçues:', data)
    console.log('📊 [payloadApi] Nombre total d\'articles épinglés:', data.docs?.length || 0)

    if (data.docs && data.docs.length > 0) {
      console.log('📋 [payloadApi] Premier article (exemple):', data.docs[0])
    }

    // Si aucun article, retourner un tableau vide
    if (!data.docs || data.docs.length === 0) {
      console.warn('⚠️ [payloadApi] Aucun article dans la réponse')
      return []
    }

    // Filtrer les articles épinglés ET publiés côté client
    // IMPORTANT : Exclure le dernier article publié (affiché dans BlogHeroSection)
    const pinnedAndPublishedArticles = data.docs.filter(article => {
      const isPinned = article.pinned === true
      const isPublished = article.status === 'published'
      const isNotLatestArticle = article.id !== latestArticleId

      console.log(`📄 Article "${article.title}":`, {
        id: article.id,
        pinned: article.pinned,
        isPinned,
        status: article.status,
        isPublished,
        isNotLatestArticle,
        willBeIncluded: isPinned && isPublished && isNotLatestArticle
      })

      // Filtrer sur pinned ET status='published' ET pas le dernier article
      return isPinned && isPublished && isNotLatestArticle
    })

    console.log('📋 [payloadApi] Articles épinglés ET publiés:', pinnedAndPublishedArticles.length, 'sur', data.docs.length)

    if (pinnedAndPublishedArticles.length === 0) {
      console.warn('⚠️ [payloadApi] Aucun article épinglé et publié trouvé')
      return []
    }

    // Sélectionner 4 articles aléatoirement (ou moins si pas assez disponibles)
    const shuffled = [...pinnedAndPublishedArticles].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 4)
    console.log('🎲 [payloadApi] Articles sélectionnés aléatoirement:', selected.length, 'articles')
    return selected
  } catch (error) {
    if (error instanceof PayloadApiError) {
      throw error
    }

    if (error instanceof Error) {
      throw new PayloadApiError(
        `Erreur réseau lors de la récupération des articles épinglés: ${error.message}`,
        0,
        'Erreur réseau'
      )
    }

    throw new PayloadApiError(
      'Une erreur inconnue s\'est produite',
      0,
      'Erreur inconnue'
    )
  }
}
