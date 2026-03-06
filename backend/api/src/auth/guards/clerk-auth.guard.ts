import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import type { AuthUser } from '@/auth/interfaces/auth-user.interface'

@Injectable()
export class ClerkAuthGuard extends AuthGuard('clerk-jwt') {
  handleRequest(err: unknown, user: AuthUser | null): AuthUser {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException('Invalid Clerk authentication token')
    }
    return user
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest()
  }
}
