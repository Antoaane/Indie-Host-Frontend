import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { ArrivalModule } from '@/arrival/arrival.module'
import { AuthModule } from '@/auth/auth.module'
import { BookingsModule } from '@/bookings/bookings.module'
import configuration from '@/config/configuration'
import { envValidationSchema } from '@/config/env.validation'
import { CalendarModule } from '@/calendar/calendar.module'
import { CommentsModule } from '@/comments/comments.module'
import { ListingsModule } from '@/listings/listings.module'
import { MediasModule } from '@/medias/medias.module'
import { MessagingModule } from '@/messaging/messaging.module'
import { NotesModule } from '@/notes/notes.module'
import { PaymentsModule } from '@/payments/payments.module'
import { PrismaModule } from '@/common/prisma/prisma.module'
import { UsersModule } from '@/users/users.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      expandVariables: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ListingsModule,
    BookingsModule,
    MediasModule,
    ArrivalModule,
    NotesModule,
    CommentsModule,
    MessagingModule,
    PaymentsModule,
    CalendarModule,
  ],
})
export class AppModule {}
