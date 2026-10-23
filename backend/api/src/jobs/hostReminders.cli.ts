import { PrismaClient } from '@prisma/client';

import { runHostReminders, type HostRemindersLogger } from './hostReminders.js';

// Lancement manuel des rappels aux hôtes :
//   npm run host-reminders -- --dry-run   # liste ce qui partirait, sans rien envoyer ni enregistrer
//   npm run host-reminders -- --force     # ignore la plage d'envoi (9 h – 20 h, heure de Paris)
// En prod : `node dist/jobs/hostReminders.cli.js --dry-run` dans le conteneur api.

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const ignoreSendWindow = args.includes('--force') || dryRun;

function createConsoleLogger(): HostRemindersLogger {
  const write = (level: 'info' | 'warn' | 'error') => (...values: unknown[]) => {
    const [first, ...rest] = values;
    const payload = typeof first === 'string' ? { msg: first } : { ...(first as object), msg: rest.find((value) => typeof value === 'string') };
    const line = JSON.stringify({ level, time: new Date().toISOString(), ...payload });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };
  return { info: write('info'), warn: write('warn'), error: write('error') } as unknown as HostRemindersLogger;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const report = await runHostReminders(prisma, createConsoleLogger(), { dryRun, ignoreSendWindow });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
