// Types pour l'API Payload CMS

// Type pour la collection Media
export interface PayloadMedia {
  id: string
  alt?: string
  url: string
  filename: string
  mimeType: string
  filesize: number
  width?: number
  height?: number
  createdAt: string
  updatedAt: string
}

// Type pour la collection Author
export interface PayloadAuthor {
  id: string
  name: string
  email?: string
  bio?: string
  avatar?: PayloadMedia | string
  createdAt: string
  updatedAt: string
}

// Type pour la collection Category
export interface PayloadCategory {
  id: string
  name: string
  slug: string
  description?: string
  createdAt: string
  updatedAt: string
}

// Type pour un article de la collection Articles
export interface PayloadArticle {
  id: string
  title: string
  slug: string
  excerpt?: string
  content?: any // Lexical/Slate rich text - structure complexe
  featuredImage?: PayloadMedia | string // Peut être une relation populée ou juste un ID
  author?: PayloadAuthor | string // Peut être une relation populée ou juste un ID
  categories?: (PayloadCategory | string)[] // Peut être des relations populées ou juste des IDs
  publishedDate?: string
  isPinned?: boolean
  _status?: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

// Type pour la réponse de l'API Payload (format standard)
export interface PayloadResponse<T> {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}

// Type spécifique pour la réponse des articles
export type PayloadArticlesResponse = PayloadResponse<PayloadArticle>
