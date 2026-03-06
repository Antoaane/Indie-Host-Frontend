import { ForbiddenException, Injectable } from '@nestjs/common'

import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import { ListingsService } from '@/listings/listings.service'
import type { UpdateMyProfileDto } from '@/users/dto/update-my-profile.dto'
import { UsersRepository } from '@/users/users.repository'

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly listingsService: ListingsService,
  ) {}

  async getMe(authUser: AuthUser) {
    return this.usersRepository.upsertByClerkUserId(authUser.userId)
  }

  async updateMe(authUser: AuthUser, payload: UpdateMyProfileDto) {
    return this.usersRepository.upsertByClerkUserId(authUser.userId, payload)
  }

  async getUserListingsForCompatibility(targetUserId: string, authUser: AuthUser | null) {
    if (authUser?.userId && authUser.userId !== targetUserId) {
      throw new ForbiddenException('You can only access your own listings')
    }

    return this.listingsService.getUserListings(targetUserId)
  }
}
