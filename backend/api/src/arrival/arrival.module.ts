import { Module } from '@nestjs/common'

import { ArrivalController } from '@/arrival/arrival.controller'
import { ArrivalRepository } from '@/arrival/arrival.repository'
import { ArrivalService } from '@/arrival/arrival.service'
import { AuthModule } from '@/auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [ArrivalController],
  providers: [ArrivalRepository, ArrivalService],
  exports: [ArrivalRepository, ArrivalService],
})
export class ArrivalModule {}
