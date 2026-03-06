import { IsEmail, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsUrl()
  avatarUrl?: string
}
