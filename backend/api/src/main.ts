import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from '@/app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  const port = configService.get<number>('app.port') ?? 4000
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'v1'
  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? []

  app.setGlobalPrefix(apiPrefix)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: false,
  })

  await app.listen(port)
  Logger.log(`IndieHost API listening on http://localhost:${port}/${apiPrefix}`, 'Bootstrap')
}

void bootstrap()
