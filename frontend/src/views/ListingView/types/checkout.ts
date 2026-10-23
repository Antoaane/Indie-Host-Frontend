// File: src/views/ListingView/types/checkout.ts

import type { CheckoutPaymentBreakdown, CheckoutPaymentChoice } from '@/domain/payments/checkoutPayment'

export type CheckoutConfirmationPayload = {
  travelerMessage: string
  travelerContact: {
    firstName: string
    lastName: string
    phone: string
    // Adresse normalisée (trim + minuscules) : support durable de la confirmation (art. L221-13 C. conso).
    email: string
  }
  cardholder: {
    firstName: string
    lastName: string
    fullName: string
  }
  paymentChoice: CheckoutPaymentChoice
  payment: {
    breakdown: CheckoutPaymentBreakdown
    paymentIntentId: string
    paymentIntentStatus: string
    currency: string
    connectedAccountId: string
  }
}
