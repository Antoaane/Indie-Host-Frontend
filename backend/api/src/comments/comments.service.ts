import { Injectable } from '@nestjs/common'

import { CommentsRepository } from '@/comments/comments.repository'

@Injectable()
export class CommentsService {
  constructor(private readonly commentsRepository: CommentsRepository) {}

  async getComments(listingId: string) {
    return this.commentsRepository.getCommentsResource(listingId)
  }

  async patchComments(listingId: string, patch: Record<string, unknown>) {
    return this.commentsRepository.patchCommentsResource(listingId, patch)
  }
}
