import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common'

import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard'
import { CreateCalendarSyncDto } from '@/calendar/dto/create-calendar-sync.dto'
import { ListCalendarEventsQueryDto } from '@/calendar/dto/list-calendar-events-query.dto'
import { CalendarService } from '@/calendar/calendar.service'

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('listings/:listingId/events')
  async listEvents(
    @Param('listingId') listingId: string,
    @Query() query: ListCalendarEventsQueryDto,
  ) {
    return this.calendarService.listEvents(listingId, query)
  }

  @Get('listings/:listingId/ical')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async exportIcal(@Param('listingId') listingId: string) {
    return this.calendarService.exportIcal(listingId)
  }

  @Get('listings/:listingId/syncs')
  async listSyncs(@Param('listingId') listingId: string) {
    return this.calendarService.listSyncs(listingId)
  }

  @Post('listings/:listingId/syncs')
  @UseGuards(ClerkAuthGuard)
  async createSync(
    @Param('listingId') listingId: string,
    @Body() payload: CreateCalendarSyncDto,
  ) {
    return this.calendarService.createSync(listingId, payload)
  }

  @Post('syncs/:syncId/pull')
  @UseGuards(ClerkAuthGuard)
  async pullSync(@Param('syncId') syncId: string) {
    return this.calendarService.pullSync(syncId)
  }
}
