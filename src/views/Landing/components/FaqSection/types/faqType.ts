// File: src/views/Landing/FaqSection/types/faqType.ts

export interface FaqNode {
  id: string
  title?: string
  question?: string
  answer?: string
  children?: FaqNode[]
}