import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { ListingsModule } from '@/listings/listings.module'
import { UsersController } from '@/users/users.controller'
import { UsersRepository } from '@/users/users.repository'
import { UsersService } from '@/users/users.service'

@Module({
  imports: [AuthModule, ListingsModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
