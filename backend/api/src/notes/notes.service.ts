import { Injectable } from '@nestjs/common'

import { NotesRepository } from '@/notes/notes.repository'

@Injectable()
export class NotesService {
  constructor(private readonly notesRepository: NotesRepository) {}

  async getNotes(listingId: string) {
    return this.notesRepository.getNotesResource(listingId)
  }

  async patchNotes(listingId: string, patch: Record<string, unknown>) {
    return this.notesRepository.patchNotesResource(listingId, patch)
  }
}
