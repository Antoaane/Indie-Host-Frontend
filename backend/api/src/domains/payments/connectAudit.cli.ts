// Contrôle des comptes Stripe Connect rattachés aux profils, en lecture seule.
//
// Avant le 2026-11-12, un numéro de compte envoyé par le navigateur pouvait être rattaché à un profil
// sans contrôle (un numéro de compte est public : il accompagne chaque paiement). Ce script relit chez
// Stripe chaque compte connu d'un profil et vérifie qu'il a été créé pour ce profil : IndieHost pose
// `metadata.userId` à la création. Il n'écrit rien, ni en base ni chez Stripe.
//
//   npm run connect-audit
//   En prod : docker compose exec -T api node dist/domains/payments/connectAudit.cli.js
//
// Code de sortie 2 quand un compte est à examiner (autre propriétaire, compte partagé entre profils).

import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

import { env } from '../../config/env.js';

type Verdict = 'ok' | 'autre propriétaire' | 'sans propriétaire déclaré' | 'introuvable chez Stripe' | 'compte simulé';

type Row = {
  userId: string;
  email: string;
  accountId: string;
  role: string;
  verdict: Verdict;
  detail: string;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function main() {
  if (!env.STRIPE_SECRET_KEY) {
    console.log('Aucune clé Stripe sur ce serveur : rien à contrôler.');
    return 0;
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, stripeConnectAccountId: true, stripeConnectProfile: true },
    });

    // Chaque numéro connu d'un profil : celui rattaché, celui du profil Stripe, l'ancien compte remplacé.
    const references: Array<{ userId: string; email: string; accountId: string; role: string }> = [];
    for (const user of users) {
      const profile = asObject(user.stripeConnectProfile);
      const seen = new Set<string>();
      const add = (accountId: string | null, role: string) => {
        if (!accountId || seen.has(accountId)) return;
        seen.add(accountId);
        references.push({ userId: user.id, email: user.email ?? '—', accountId, role });
      };
      add(readString(user.stripeConnectAccountId), 'rattaché');
      add(readString(profile.accountId), 'profil');
      add(readString(profile.replacedAccountId), 'ancien compte remplacé');
    }

    if (!references.length) {
      console.log('Aucun compte Stripe Connect rattaché à un profil.');
      return 0;
    }

    const rows: Row[] = [];
    for (const reference of references) {
      if (reference.accountId.startsWith('acct_mock_')) {
        rows.push({ ...reference, verdict: 'compte simulé', detail: 'créé sans clé Stripe' });
        continue;
      }
      try {
        const account = await stripe.accounts.retrieve(reference.accountId);
        const createdFor = readString(account.metadata?.userId);
        const state = `${account.details_submitted ? 'inscription envoyée' : 'inscription à faire'}, paiements ${account.charges_enabled ? 'ouverts' : 'fermés'}`;
        if (!createdFor) rows.push({ ...reference, verdict: 'sans propriétaire déclaré', detail: state });
        else if (createdFor !== reference.userId) rows.push({ ...reference, verdict: 'autre propriétaire', detail: `créé pour ${createdFor} · ${state}` });
        else rows.push({ ...reference, verdict: 'ok', detail: state });
      } catch (error) {
        const code = (error as { code?: string })?.code ?? (error instanceof Error ? error.message : 'erreur');
        rows.push({ ...reference, verdict: 'introuvable chez Stripe', detail: code });
      }
    }

    // Un même compte rattaché à plusieurs profils.
    const attached = new Map<string, string[]>();
    for (const row of rows) {
      if (row.role !== 'rattaché') continue;
      attached.set(row.accountId, [...(attached.get(row.accountId) ?? []), row.userId]);
    }
    const shared = [...attached.entries()].filter(([, owners]) => owners.length > 1);

    for (const row of rows) {
      console.log([row.verdict === 'ok' ? 'ok ' : '!! ', row.accountId, row.role, `profil ${row.userId} (${row.email})`, row.verdict, row.detail].join(' · '));
    }
    for (const [accountId, owners] of shared) {
      console.log(`!!  ${accountId} · rattaché à ${owners.length} profils : ${owners.join(', ')}`);
    }

    const suspicious = rows.filter((row) => row.verdict === 'autre propriétaire' && row.role !== 'ancien compte remplacé');
    console.log('');
    console.log(`${rows.length} numéro(s) contrôlé(s) pour ${new Set(rows.map((row) => row.userId)).size} profil(s).`);
    if (!suspicious.length && !shared.length) {
      console.log('Aucun compte rattaché au mauvais profil.');
      return 0;
    }
    console.log(`${suspicious.length + shared.length} point(s) à examiner : ne rien détacher sans vérifier à qui appartient le compte dans le Dashboard Stripe.`);
    return 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
