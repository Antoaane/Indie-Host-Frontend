import { PrismaClient } from '@prisma/client';

import { runPublicSites, type PublicSitesLogger } from './publicSites.js';

// Lancement manuel du référencement des sites d'hôtes :
//   npm run public-sites -- --dry-run   # ce qui serait fait, sans rien écrire ni envoyer
//   npm run public-sites                # passe complète (pré-remplissage, Search Console, IndexNow)
// En prod : `node dist/jobs/publicSites.cli.js --dry-run` dans le conteneur api.

const dryRun = process.argv.slice(2).includes('--dry-run');

function createConsoleLogger(): PublicSitesLogger {
  const write = (level: 'info' | 'warn' | 'error') => (first: unknown, message?: string) => {
    const payload = typeof first === 'string' ? { msg: first } : { ...(first as object), msg: message };
    const line = JSON.stringify({ level, time: new Date().toISOString(), ...payload });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };
  return { info: write('info'), warn: write('warn'), error: write('error') };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const report = await runPublicSites(prisma, createConsoleLogger(), { dryRun });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
