import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'

import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard'
import { NotesService } from '@/notes/notes.service'

@Controller('listings/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get(':listingId')
  async getNotes(@Param('listingId') listingId: string) {
    return this.notesService.getNotes(listingId)
  }

  @Patch(':listingId')
  @UseGuards(ClerkAuthGuard)
  async patchNotes(
    @Param('listingId') listingId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.notesService.patchNotes(listingId, patch)
  }
}
