import { IsObject, IsOptional } from 'class-validator'

export class CreateListingDto {
  @IsOptional()
  @IsObject()
  core?: Record<string, unknown> | null

  @IsOptional()
  @IsObject()
  bookings?: Record<string, unknown> | null

  @IsOptional()
  @IsObject()
  medias?: Record<string, unknown> | null

  @IsOptional()
  @IsObject()
  arrival?: Record<string, unknown> | null

  @IsOptional()
  @IsObject()
  notes?: Record<string, unknown> | null

  @IsOptional()
  @IsObject()
  comments?: Record<string, unknown> | null

  @IsOptional()
  @IsObject()
  host?: Record<string, unknown> | null
}
