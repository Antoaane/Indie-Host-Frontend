import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { ListingsController } from '@/listings/listings.controller'
import { ListingsRepository } from '@/listings/listings.repository'
import { ListingsService } from '@/listings/listings.service'

@Module({
  imports: [AuthModule],
  controllers: [ListingsController],
  providers: [ListingsRepository, ListingsService],
  exports: [ListingsRepository, ListingsService],
})
export class ListingsModule {}
