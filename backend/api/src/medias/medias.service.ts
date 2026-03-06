import { Injectable } from '@nestjs/common'

import { MediasRepository } from '@/medias/medias.repository'

@Injectable()
export class MediasService {
  constructor(private readonly mediasRepository: MediasRepository) {}

  async getMedias(listingId: string) {
    return this.mediasRepository.getMediasResource(listingId)
  }

  async patchMedias(listingId: string, patch: Record<string, unknown>) {
    return this.mediasRepository.patchMediasResource(listingId, patch)
  }
}
