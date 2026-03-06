import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateConversationDto {
  @IsString()
  listingId!: string

  @IsOptional()
  @IsString()
  reservationId?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string

  @IsOptional()
  @IsString()
  guestIdentifier?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestName?: string
}
