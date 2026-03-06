import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { passportJwtSecret } from 'jwks-rsa'
import { ExtractJwt, Strategy, type SecretOrKeyProvider } from 'passport-jwt'

import type { AuthUser } from '@/auth/interfaces/auth-user.interface'

@Injectable()
export class ClerkJwtStrategy extends PassportStrategy(Strategy, 'clerk-jwt') {
  constructor(configService: ConfigService) {
    const jwksUri = configService.get<string>('auth.clerkJwksUrl')?.trim()
    const issuer = configService.get<string>('auth.clerkIssuer')?.trim()
    const audience = configService.get<string>('auth.clerkAudience')?.trim()

    const strategyOptions = jwksUri
      ? {
          jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
          ignoreExpiration: false,
          algorithms: ['RS256'],
          secretOrKeyProvider: passportJwtSecret({
            cache: true,
            cacheMaxEntries: 10,
            cacheMaxAge: 10 * 60 * 1000,
            rateLimit: true,
            jwksRequestsPerMinute: 10,
            jwksUri,
          }) as SecretOrKeyProvider,
          ...(issuer ? { issuer } : {}),
          ...(audience ? { audience } : {}),
        }
      : {
          jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
          ignoreExpiration: false,
          algorithms: ['HS256'],
          secretOrKey: '__clerk_not_configured__',
        }

    super(strategyOptions)
  }

  validate(payload: Record<string, unknown>): AuthUser {
    const sub = typeof payload.sub === 'string' ? payload.sub : ''
    if (!sub) {
      throw new UnauthorizedException('Token payload does not include a subject')
    }

    return {
      userId: sub,
      sessionId: typeof payload.sid === 'string' ? payload.sid : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      raw: payload,
    }
  }
}
