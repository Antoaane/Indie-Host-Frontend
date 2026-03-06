import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'

import { CurrentAuth } from '@/auth/decorators/current-auth.decorator'
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard'
import { OptionalClerkAuthGuard } from '@/auth/guards/optional-clerk-auth.guard'
import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import { UpdateMyProfileDto } from '@/users/dto/update-my-profile.dto'
import { UsersService } from '@/users/users.service'

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/me')
  @UseGuards(ClerkAuthGuard)
  async getMe(@CurrentAuth() authUser: AuthUser) {
    return this.usersService.getMe(authUser)
  }

  @Patch('users/me')
  @UseGuards(ClerkAuthGuard)
  async updateMe(
    @CurrentAuth() authUser: AuthUser,
    @Body() payload: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMe(authUser, payload)
  }

  @Get('user/:userId/listings')
  @UseGuards(OptionalClerkAuthGuard)
  async getUserListings(
    @Param('userId') userId: string,
    @CurrentAuth() authUser: AuthUser | null,
  ) {
    return this.usersService.getUserListingsForCompatibility(userId, authUser)
  }
}
