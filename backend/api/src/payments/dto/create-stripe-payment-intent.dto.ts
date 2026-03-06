import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'

class ReservationOccupantsDto {
  @IsInt()
  @Min(0)
  adults!: number

  @IsInt()
  @Min(0)
  children!: number

  @IsInt()
  @Min(0)
  babies!: number

  @IsInt()
  @Min(0)
  animals!: number

  @IsInt()
  @Min(0)
  pmr!: number
}

class ReservationDto {
  @IsString()
  startISO!: string

  @IsString()
  endISO!: string

  @IsInt()
  @Min(1)
  nights!: number

  @IsInt()
  @Min(0)
  total!: number

  @ValidateNested()
  @Type(() => ReservationOccupantsDto)
  occupants!: ReservationOccupantsDto

  @IsOptional()
  @IsArray()
  fees?: Array<Record<string, unknown>>

  @IsOptional()
  @IsObject()
  pricing?: Record<string, unknown>
}

class PaymentBreakdownDto {
  @IsString()
  @IsIn(['full', 'split', 'cash'])
  choice!: 'full' | 'split' | 'cash'

  @IsInt()
  @Min(0)
  totalAmount!: number

  @IsInt()
  @Min(0)
  chargeNowAmount!: number

  @IsInt()
  @Min(0)
  deferredAmount!: number

  @IsString()
  @IsIn(['none', 'online', 'cash'])
  deferredMode!: 'none' | 'online' | 'cash'

  @IsOptional()
  @IsString()
  deferredDueDateISO?: string | null
}

export class CreateStripePaymentIntentDto {
  @IsString()
  listingId!: string

  @IsString()
  connectedAccountId!: string

  @IsOptional()
  @IsString()
  currency?: string

  @ValidateNested()
  @Type(() => ReservationDto)
  reservation!: ReservationDto

  @ValidateNested()
  @Type(() => PaymentBreakdownDto)
  payment!: PaymentBreakdownDto

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>
}
