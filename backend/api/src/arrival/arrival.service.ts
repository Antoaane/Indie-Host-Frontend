import { Injectable } from '@nestjs/common'

import { ArrivalRepository } from '@/arrival/arrival.repository'

@Injectable()
export class ArrivalService {
  constructor(private readonly arrivalRepository: ArrivalRepository) {}

  async getArrival(listingId: string) {
    return this.arrivalRepository.getArrivalResource(listingId)
  }

  async patchArrival(listingId: string, patch: Record<string, unknown>) {
    return this.arrivalRepository.patchArrivalResource(listingId, patch)
  }
}
