import { PrismaClient } from '@prisma/client';

import { env } from '../config/env.js';

import { assessCalendarSyncReport, listCalendarSyncSources, runCalendarSync } from './calendarSync.js';

// Lancement manuel de la synchronisation des calendriers importés :
//   npm run calendar-sync -- --dry-run   # liste des calendriers et de leur dernière relecture, sans rien relire
//   npm run calendar-sync                # relit tous les calendriers tout de suite
// En prod : `node dist/jobs/calendarSync.cli.js --dry-run` dans le conteneur api.

const dryRun = process.argv.slice(2).includes('--dry-run');

async function main() {
  const prisma = new PrismaClient();
  try {
    if (dryRun) {
      console.log(JSON.stringify({
        enabled: env.ICAL_SYNC_JOB_ENABLED,
        intervalSeconds: env.ICAL_SYNC_JOB_INTERVAL_SECONDS,
        sources: await listCalendarSyncSources(prisma),
      }, null, 2));
      return;
    }

    // Passe demandée à la main : tous les calendriers, même relus à l'instant.
    const report = await runCalendarSync(prisma, { minAgeMs: 0 });
    console.log(JSON.stringify({ report, verdict: assessCalendarSyncReport(report) ?? 'ok' }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
