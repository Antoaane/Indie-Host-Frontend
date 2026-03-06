import { IsOptional, IsString } from 'class-validator'

export class ListConversationsQueryDto {
  @IsOptional()
  @IsString()
  listingId?: string

  @IsOptional()
  @IsString()
  reservationId?: string

  @IsOptional()
  @IsString()
  guestIdentifier?: string
}
