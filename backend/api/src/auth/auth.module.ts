import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'

import { ClerkJwtStrategy } from '@/auth/clerk-jwt.strategy'
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard'
import { OptionalClerkAuthGuard } from '@/auth/guards/optional-clerk-auth.guard'

@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'clerk-jwt' })],
  providers: [ClerkJwtStrategy, ClerkAuthGuard, OptionalClerkAuthGuard],
  exports: [ClerkAuthGuard, OptionalClerkAuthGuard, PassportModule],
})
export class AuthModule {}
