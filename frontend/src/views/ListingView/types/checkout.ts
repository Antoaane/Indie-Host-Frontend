// File: src/views/ListingView/types/checkout.ts

import type { CheckoutPaymentBreakdown, CheckoutPaymentChoice } from '@/domain/payments/checkoutPayment'

export type CheckoutConfirmationPayload = {
  travelerMessage: string
  travelerContact: {
    firstName: string
    lastName: string
    phone: string
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
