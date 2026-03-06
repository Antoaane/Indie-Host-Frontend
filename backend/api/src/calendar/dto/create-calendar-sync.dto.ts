import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator'

export class CreateCalendarSyncDto {
  @IsString()
  externalUrl!: string

  @IsOptional()
  @IsString()
  @IsIn(['ical', 'airbnb', 'booking', 'vrbo', 'manual'])
  provider?: 'ical' | 'airbnb' | 'booking' | 'vrbo' | 'manual'

  @IsOptional()
  @IsString()
  @IsIn(['import', 'export', 'bidirectional'])
  direction?: 'import' | 'export' | 'bidirectional'

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
