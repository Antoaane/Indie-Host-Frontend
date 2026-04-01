// File: src/views/Landing/types/content.ts

export interface MediaAsset {
  webp: string
  png?: string
  alt?: string
}

export interface VideoAsset {
  webm?: string
  mp4?: string
}

export interface CtaLink {
  label: string
  href: string
  target?: string
  rel?: string
  ariaLabel?: string
}

export interface HeroContent {
  title: string
  description: string
  descriptionDesktop?: string
  inputPlaceholder: string
  inputPlaceholders?: string[]
  primaryCta: CtaLink
  secondaryCta: CtaLink
  images: MediaAsset[]
}

export interface BenefitsContent {
  title: string
}

export interface IntroSectionContent {
  title: string
  body: string
  inputPlaceholder: string
  previewCtaLabel: string
  createAccountCtaLabel: string
  createAccountCtaHint?: string
  backButtonAriaLabel?: string
  primaryCta: CtaLink
}

export interface UsageStep {
  id: string
  title: string
  description: string
  videos?: VideoAsset[]
  images?: MediaAsset[]
}

export interface FeaturesContent {
  items: FeatureItem[]
}

export interface FeatureItem {
  id: string
  title: string
  description: string
  descriptionTablet?: string
  layout?: 'hzt' | 'vtc' | 'sqr'
  videos?: VideoAsset[]
  images?: MediaAsset[]
}

export interface HowContent {
  title: string
  body: string
}

export interface HabitsContent {
  title: string
  slides: HabitsSlide[]
}

export type HabitsSlide = {
  id: string
  title: string
  description: string
  images: MediaAsset[]
}

export interface StrengthsContent {
  title: string
  subtitle: string
  pillars: Array<{
    id: string
    title: string
    description: string
  }>
}

export interface ProofSectionContent {
  eyebrow: string
  title: string
  subtitle: string
  demoVideoLabel: string
  metrics: Array<{
    id: string
    value: string
    label: string
    detail?: string
  }>
  cards: Array<{
    id: string
    title: string
    description: string
  }>
}

export interface RoiSectionContent {
  eyebrow: string
  title: string
  subtitle: string
  scenario: {
    title: string
    revenueLabel: string
    revenueValue: string
    otaCostLabel: string
    otaCostValue: string
    indiehostCostLabel: string
    indiehostCostValue: string
    savingsLabel: string
    savingsValue: string
    note: string
  }
  bullets?: string[]
  interactive?: {
    helper: string
    revenueHint: string
    directShareLabel: string
    directShareNote: string
    directRevenueLabel: string
    netGainLabel: string
    breakEvenTemplate: string
  }
  compare?: {
    title: string
    intro: string
    freeTitle: string
    freePrice: string
    freePoints: string[]
    superhostTitle: string
    superhostPrice: string
    superhostPoints: string[]
    note: string
  }
}

export interface FinalCtaSectionContent {
  eyebrow: string
  title: string
  body: string
  primaryCta: CtaLink
  secondaryCta: CtaLink
  note?: string
}

export interface JoinFormField {
  name: string
  placeholder: string
  type: string
  required?: boolean
}

export interface JoinFormGroup {
  legend: string
  name: string
  type: string
  options: Array<{ label: string; value: string }>
}

export interface JoinFormConsent {
  label: string
  name: string
  type: string
  required?: boolean
}

export interface JoinFormSubmit {
  label: string
  icon?: string
}

export interface JoinFormValidationField {
  minLength?: number
  maxLength?: number
  autocomplete?: string
  inputMode?: 'text' | 'email' | 'tel' | 'numeric'
  pattern?: string
  patternTitle?: string
}

export interface JoinFormSimpleTextDefaults {
  maxLength?: number
  hideIndicatorAt?: number
}

export interface JoinFormValidation {
  defaults?: {
    simpleText?: JoinFormSimpleTextDefaults
  }
  fields?: {
    text?: JoinFormValidationField
    email?: JoinFormValidationField
    tel?: JoinFormValidationField
    zip?: JoinFormValidationField
  }
  nameAutocomplete?: {
    first?: string
    last?: string
    name?: string
    default?: string
  }
}

export interface JoinContent {
  title: string
  description: string
  flagIcon: string
  cta: CtaLink
  form: {
    title: string
    description: string
    variant: string
    fields: JoinFormField[]
    groups: JoinFormGroup[]
    consents: JoinFormConsent[]
    validation?: JoinFormValidation
    submit: JoinFormSubmit
  }
}

export interface FaqNode {
  id: string
  title?: string
  question?: string
  answer?: string
  children?: FaqNode[]
}

export interface FaqContent {
  title: string
  searchPlaceholder: string
  searchLabel?: string
  nodes: FaqNode[]
}

export interface PricingSectionContent {
  eyebrow: string
  title: string
  subtitle: string
  toggleExpandLabel: string
  toggleCollapseLabel: string
  accountPrefix: string
  accountLinkLabel: string
}

export interface LandingContent {
  hero: HeroContent
  introSection: IntroSectionContent
  benefits: BenefitsContent
  usage: { steps: UsageStep[] }
  features: FeaturesContent
  how: HowContent
  habits: HabitsContent
  proofSection: ProofSectionContent
  strengths: StrengthsContent
  pricingSection: PricingSectionContent
  roiSection: RoiSectionContent
  join: JoinContent
  faq: FaqContent
  finalCtaSection: FinalCtaSectionContent
}
