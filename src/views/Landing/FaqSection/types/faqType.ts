// File: src/views/Landing/FaqSection/utils/faqData.ts

export interface FaqNode {
  id: string
  title?: string
  question?: string
  answer?: string
  children?: FaqNode[]
}