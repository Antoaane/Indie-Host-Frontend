import { IsObject } from 'class-validator'

export class PatchCoreDto {
  @IsObject()
  core!: Record<string, unknown>
}
