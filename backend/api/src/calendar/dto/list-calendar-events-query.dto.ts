import { IsOptional, IsString } from 'class-validator'

export class ListCalendarEventsQueryDto {
  @IsOptional()
  @IsString()
  start?: string

  @IsOptional()
  @IsString()
  end?: string
}
