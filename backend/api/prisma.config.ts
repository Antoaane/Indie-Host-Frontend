// Configuration de la ligne de commande Prisma 7 (migrate deploy, db push, generate, studio).
// Prisma ne lit plus le .env de lui-même : dotenv le charge (backend/api/.env, hors Docker).
// En conteneur, DATABASE_URL vient de scripts/docker-run-with-database-url.sh (secret Docker).
// `prisma generate` n'en a pas besoin : l'image se construit sans URL.
import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
