import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/common/prisma/prisma.service'
import type { UpdateMyProfileDto } from '@/users/dto/update-my-profile.dto'

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByClerkUserId(clerkUserId: string, payload?: UpdateMyProfileDto) {
    return this.prisma.user.upsert({
      where: { clerkUserId },
      update: {
        ...(payload?.email ? { email: payload.email } : {}),
        ...(payload?.firstName ? { firstName: payload.firstName } : {}),
        ...(payload?.lastName ? { lastName: payload.lastName } : {}),
        ...(payload?.avatarUrl ? { avatarUrl: payload.avatarUrl } : {}),
      },
      create: {
        clerkUserId,
        role: 'HOST',
        email: payload?.email,
        firstName: payload?.firstName,
        lastName: payload?.lastName,
        avatarUrl: payload?.avatarUrl,
      },
    })
  }

  async findByClerkUserId(clerkUserId: string) {
    return this.prisma.user.findUnique({
      where: { clerkUserId },
    })
  }
}
