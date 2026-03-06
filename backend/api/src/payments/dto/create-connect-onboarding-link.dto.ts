import { IsOptional, IsString, IsUrl } from 'class-validator'

export class CreateConnectOnboardingLinkDto {
  @IsOptional()
  @IsUrl()
  refreshUrl?: string

  @IsOptional()
  @IsUrl()
  returnUrl?: string

  @IsOptional()
  @IsString()
  type?: 'account_onboarding' | 'account_update'
}
