// File: src/views/Donation/types/content.ts

export interface DonationPageContent {
  title: string
  subtitles: string[]
}

export interface DonationArticleSection {
  type: string
  title?: string
  paragraphs?: string[] | null
  items?: string[] | null
  content?: string | null
  cite?: string | null
}

export interface DonationArticleContent {
  eyebrow: string
  title: string
  lead: string
  intro: string
  sections: DonationArticleSection[]
}

export interface DonationPanelContent {
  title: string
  intro: string[]
  steps: { title?: string; body?: string }[]
  primaryCta: { label: string }
  note: string
  warnings: Array<{ id: string; text: string; condition?: string }>
}

export interface DonationStatusContent {
  messages: Record<
    string,
    {
      severity?: string
      title: string
      body: string
    }
  >
}

export interface DonationContent {
  page: DonationPageContent
  article: DonationArticleContent
  panel: DonationPanelContent
  status: DonationStatusContent
}
