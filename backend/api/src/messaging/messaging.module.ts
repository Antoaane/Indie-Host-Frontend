import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { MessagingController } from '@/messaging/messaging.controller'
import { MessagingRepository } from '@/messaging/messaging.repository'
import { MessagingService } from '@/messaging/messaging.service'

@Module({
  imports: [AuthModule],
  controllers: [MessagingController],
  providers: [MessagingRepository, MessagingService],
  exports: [MessagingRepository, MessagingService],
})
export class MessagingModule {}
