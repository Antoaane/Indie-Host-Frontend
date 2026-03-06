import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'

import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard'
import { CommentsService } from '@/comments/comments.service'

@Controller('listings/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(':listingId')
  async getComments(@Param('listingId') listingId: string) {
    return this.commentsService.getComments(listingId)
  }

  @Patch(':listingId')
  @UseGuards(ClerkAuthGuard)
  async patchComments(
    @Param('listingId') listingId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.commentsService.patchComments(listingId, patch)
  }
}
