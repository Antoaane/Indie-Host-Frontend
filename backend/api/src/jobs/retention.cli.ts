import { readFileSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';

import { runRetentionPurge, type RetentionLogger } from './retention.js';

// Lancement manuel : `npm run purge` (tsx) ou `node dist/jobs/retention.cli.js` dans l'image de prod.
// `config/env.js` n'est pas importé : seul DATABASE_URL (ou DATABASE_URL_FILE) est nécessaire.

function readDatabaseUrl(): string | undefined {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) return direct;
  const file = process.env.DATABASE_URL_FILE?.trim();
  if (!file) return undefined;
  try {
    return readFileSync(file, 'utf-8').trim() || undefined;
  } catch {
    return undefined;
  }
}

function createConsoleLogger(): RetentionLogger {
  const write = (level: 'info' | 'warn' | 'error') => (...args: unknown[]) => {
    const [first, ...rest] = args;
    const payload = typeof first === 'string' ? { msg: first } : { ...(first as object), msg: rest.find((value) => typeof value === 'string') };
    const line = JSON.stringify({ level, time: new Date().toISOString(), ...payload });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };

  return {
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  } as unknown as RetentionLogger;
}

async function main() {
  const databaseUrl = readDatabaseUrl();
  const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
  const logger = createConsoleLogger();

  try {
    await runRetentionPurge(prisma, logger);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
