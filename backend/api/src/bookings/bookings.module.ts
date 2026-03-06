import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { BookingsController } from '@/bookings/bookings.controller'
import { BookingsRepository } from '@/bookings/bookings.repository'
import { BookingsService } from '@/bookings/bookings.service'

@Module({
  imports: [AuthModule],
  controllers: [BookingsController],
  providers: [BookingsRepository, BookingsService],
  exports: [BookingsRepository, BookingsService],
})
export class BookingsModule {}
