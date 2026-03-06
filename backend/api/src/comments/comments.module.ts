import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { CommentsController } from '@/comments/comments.controller'
import { CommentsRepository } from '@/comments/comments.repository'
import { CommentsService } from '@/comments/comments.service'

@Module({
  imports: [AuthModule],
  controllers: [CommentsController],
  providers: [CommentsRepository, CommentsService],
  exports: [CommentsRepository, CommentsService],
})
export class CommentsModule {}
