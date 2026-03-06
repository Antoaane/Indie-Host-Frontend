import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { PaymentsController } from '@/payments/payments.controller'
import { PaymentsRepository } from '@/payments/payments.repository'
import { PaymentsService } from '@/payments/payments.service'
import { StripeService } from '@/payments/stripe/stripe.service'

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsRepository, PaymentsService, StripeService],
  exports: [PaymentsRepository, PaymentsService],
})
export class PaymentsModule {}
