import { env } from '../config/env.js';
import { createPrismaClient } from '../lib/prismaClient.js';

import { assessGroupPaymentsReport, listOpenGroupPayments, runGroupPaymentsPass } from './groupPayments.js';

// Lancement manuel du passage des paiements à plusieurs :
//   npm run group-payments -- --dry-run   # liste des groupes en cours (parts réglées, échéance, rappel dû), sans rien toucher
//   npm run group-payments                # passage complet : rappels, débit des groupes complets, clôture des groupes échus
// En prod : `node dist/jobs/groupPayments.cli.js --dry-run` dans le conteneur api.

const dryRun = process.argv.slice(2).includes('--dry-run');

async function main() {
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    if (dryRun) {
      console.log(JSON.stringify({
        enabled: env.GROUP_PAYMENTS_JOB_ENABLED,
        groups: await listOpenGroupPayments(prisma),
      }, null, 2));
      return;
    }

    const report = await runGroupPaymentsPass(prisma);
    console.log(JSON.stringify({ report, verdict: assessGroupPaymentsReport(report) ?? 'ok' }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
