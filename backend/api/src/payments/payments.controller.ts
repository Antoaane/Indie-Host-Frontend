import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'

import { CurrentAuth } from '@/auth/decorators/current-auth.decorator'
import { OptionalClerkAuthGuard } from '@/auth/guards/optional-clerk-auth.guard'
import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import { CreateConnectOnboardingLinkDto } from '@/payments/dto/create-connect-onboarding-link.dto'
import { CreateStripePaymentIntentDto } from '@/payments/dto/create-stripe-payment-intent.dto'
import { PaymentsService } from '@/payments/payments.service'

@Controller('payments/stripe')
@UseGuards(OptionalClerkAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payment-intents')
  async createPaymentIntent(
    @Body() payload: CreateStripePaymentIntentDto,
    @CurrentAuth() authUser: AuthUser | null,
  ) {
    return this.paymentsService.createStripePaymentIntent(payload, authUser)
  }

  @Post('connect/accounts/:accountId/onboarding-link')
  async createOnboardingLink(
    @Param('accountId') accountId: string,
    @Body() payload: CreateConnectOnboardingLinkDto,
  ) {
    return this.paymentsService.createConnectOnboardingLink(accountId, payload)
  }

  @Get('connect/accounts/:accountId/status')
  async getAccountStatus(@Param('accountId') accountId: string) {
    return this.paymentsService.getConnectAccountStatus(accountId)
  }
}
