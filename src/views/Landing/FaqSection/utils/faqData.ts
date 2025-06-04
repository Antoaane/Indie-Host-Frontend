// File: src/views/Landing/FaqSection/utils/faqData.ts

import questionAnswers from '@/views/Landing/FaqSection/content/question-answers.json'

export interface FaqNode {
  id: string
  title?: string
  question?: string
  answer?: string
  children?: FaqNode[]
}

export const faqData: FaqNode[] = questionAnswers