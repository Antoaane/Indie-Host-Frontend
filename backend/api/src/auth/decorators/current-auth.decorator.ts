import { createParamDecorator, ExecutionContext } from '@nestjs/common'

import type { AuthUser } from '@/auth/interfaces/auth-user.interface'

export const CurrentAuth = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] | null => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>()
    const user = request.user ?? null
    if (!field) return user
    return user ? user[field] : null
  },
)
