import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { MediasController } from '@/medias/medias.controller'
import { MediasRepository } from '@/medias/medias.repository'
import { MediasService } from '@/medias/medias.service'

@Module({
  imports: [AuthModule],
  controllers: [MediasController],
  providers: [MediasRepository, MediasService],
  exports: [MediasRepository, MediasService],
})
export class MediasModule {}
