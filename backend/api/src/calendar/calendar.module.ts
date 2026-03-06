import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { CalendarController } from '@/calendar/calendar.controller'
import { CalendarRepository } from '@/calendar/calendar.repository'
import { CalendarService } from '@/calendar/calendar.service'

@Module({
  imports: [AuthModule],
  controllers: [CalendarController],
  providers: [CalendarRepository, CalendarService],
  exports: [CalendarRepository, CalendarService],
})
export class CalendarModule {}
