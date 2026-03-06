import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { NotesController } from '@/notes/notes.controller'
import { NotesRepository } from '@/notes/notes.repository'
import { NotesService } from '@/notes/notes.service'

@Module({
  imports: [AuthModule],
  controllers: [NotesController],
  providers: [NotesRepository, NotesService],
  exports: [NotesRepository, NotesService],
})
export class NotesModule {}
