import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import type { AuthUser } from '@/auth/interfaces/auth-user.interface'

@Injectable()
export class OptionalClerkAuthGuard extends AuthGuard('clerk-jwt') {
  handleRequest(_err: unknown, user: AuthUser | null): AuthUser | null {
    return user ?? null
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest()
  }
}
