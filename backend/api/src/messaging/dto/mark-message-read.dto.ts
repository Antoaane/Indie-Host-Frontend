import { IsOptional, IsString, IsIn } from 'class-validator'

export class MarkMessageReadDto {
  @IsOptional()
  @IsString()
  @IsIn(['read', 'delivered', 'sent'])
  state?: 'read' | 'delivered' | 'sent'
}
