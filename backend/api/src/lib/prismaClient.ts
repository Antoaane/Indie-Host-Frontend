import os from 'node:os';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Client Prisma 7 : le moteur natif a disparu, la connexion passe par l'adaptateur `pg`.
 *
 * Réglages repris des valeurs par défaut de Prisma 6, pour garder le même comportement :
 * - au plus 2 × processeurs + 1 connexions (celles de `pg` seraient 10) ;
 * - 10 s au plus pour obtenir une connexion (`pg` attendrait sans fin) ;
 * - connexion inactive gardée 5 min (`pg` la fermerait après 10 s).
 *
 * Le schéma `?schema=…` de l'URL est passé à l'adaptateur (le pilote `pg` l'ignore).
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const schema = readSchemaParam(connectionString);
  const adapter = new PrismaPg(
    {
      connectionString,
      max: os.availableParallelism() * 2 + 1,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 300_000,
    },
    {
      ...(schema ? { schema } : {}),
      // Connexion inactive coupée (base redémarrée, réseau) : la réserve en ouvre une autre.
      onPoolError: (error) => console.warn(`[prisma] connexion à la base perdue : ${error.message}`),
    },
  );

  return new PrismaClient({ adapter });
}

function readSchemaParam(connectionString: string): string | undefined {
  try {
    return new URL(connectionString).searchParams.get('schema')?.trim() || undefined;
  } catch {
    return undefined;
  }
}
