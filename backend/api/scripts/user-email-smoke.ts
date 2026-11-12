// Vérification rapide : l'adresse e-mail d'un compte, absente du jeton Clerk, est lue chez Clerk et
// gardée en base (`domains/users/userEmail.ts`). Sans elle, aucun e-mail aux hôtes ne partait.
// Aucune base ni aucun appel réseau : Prisma et Clerk sont simulés.
// Lancer : npx tsx backend/api/scripts/user-email-smoke.ts
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';
process.env.CLERK_SECRET_KEY = 'sk_test_smoke_never_sent';

// Clerk simulé : comptes connus, appels comptés, réponse retardable.
const clerkUsers: Record<string, Record<string, unknown>> = {};
function setClerkUser(id: string, email: string | null, names: { first?: string | null; last?: string | null } = {}) {
  clerkUsers[id] = {
    id,
    primary_email_address_id: email ? 'idn_principale' : null,
    email_addresses: email
      ? [{ id: 'idn_ancienne', email_address: 'ancienne@example.test' }, { id: 'idn_principale', email_address: email }]
      : [],
    first_name: names.first ?? null,
    last_name: names.last ?? null,
  };
}
let clerkCalls = 0;
let clerkDown = false;
let clerkDelayMs = 0;
globalThis.fetch = (async (input: string | URL) => {
  clerkCalls += 1;
  if (clerkDelayMs) await new Promise((resolve) => setTimeout(resolve, clerkDelayMs));
  if (clerkDown) return new Response('indisponible', { status: 503 });
  const id = decodeURIComponent(String(input).split('/users/')[1] ?? '');
  const user = clerkUsers[id];
  return user ? new Response(JSON.stringify(user), { status: 200 }) : new Response('{}', { status: 404 });
}) as typeof fetch;

const { ensureUserEmail, resolveEmailForSending, backfillMissingUserEmails, resetUserEmailAttempts } = await import('../src/domains/users/userEmail.js');

// Prisma simulé : seules les deux requêtes SQL du module sont permises (aucune ne touche `updatedAt`).
type Row = { id: string; clerkUserId: string | null; email: string | null; firstName: string | null; lastName: string | null; deletedAt: Date | null };
const rows = new Map<string, Row>();
const statements: string[] = [];
const fakePrisma = {
  $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join('?');
    assert.doesNotMatch(sql, /updatedAt/, 'la date d’activité (purge RGPD) ne doit pas bouger');
    if (sql.includes('COALESCE')) {
      statements.push('fill');
      const [email, firstName, lastName, id] = values as [string, string | null, string | null, string];
      const row = rows.get(id);
      if (!row || row.deletedAt || row.email) return 0;
      row.email = email;
      row.firstName ||= firstName;
      row.lastName ||= lastName;
      return 1;
    }
    statements.push('replace');
    const [email, id] = values as [string, string];
    const row = rows.get(id);
    if (!row || row.deletedAt || row.email === email) return 0;
    row.email = email;
    return 1;
  },
  user: {
    findMany: async () => [...rows.values()].filter((row) => !row.deletedAt && row.clerkUserId && !row.email),
  },
};
const prisma = fakePrisma as never;

function reset() {
  rows.clear();
  statements.length = 0;
  for (const key of Object.keys(clerkUsers)) delete clerkUsers[key];
  clerkCalls = 0;
  clerkDown = false;
  clerkDelayMs = 0;
  resetUserEmailAttempts();
  setClerkUser('user_paul', 'paul@example.test', { first: 'Paul', last: 'Martin' });
  setClerkUser('user_sans_adresse', null);
}

let checks = 0;
async function check(name: string, run: () => Promise<void>) {
  try {
    reset();
    await run();
    checks += 1;
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function addRow(row: Partial<Row> & { id: string }): Row {
  const full: Row = { clerkUserId: 'user_paul', email: null, firstName: null, lastName: null, deletedAt: null, ...row };
  rows.set(full.id, full);
  return full;
}

await check('adresse déjà en base : rendue telle quelle, sans appeler Clerk', async () => {
  assert.equal(await ensureUserEmail(prisma, addRow({ id: 'u1', email: 'deja@example.test' })), 'deja@example.test');
  assert.equal(clerkCalls, 0);
});

await check('adresse absente : l’adresse principale est lue chez Clerk et enregistrée, avec le prénom et le nom', async () => {
  const row = addRow({ id: 'u1' });
  assert.equal(await ensureUserEmail(prisma, row), 'paul@example.test', 'l’adresse principale, pas la première de la liste');
  assert.deepEqual([row.email, row.firstName, row.lastName], ['paul@example.test', 'Paul', 'Martin']);
  assert.deepEqual(statements, ['fill']);
});

await check('un prénom déjà saisi n’est pas remplacé', async () => {
  const row = addRow({ id: 'u1', firstName: 'Paulo' });
  await ensureUserEmail(prisma, row);
  assert.equal(row.firstName, 'Paulo');
});

await check('Clerk indisponible : rien d’écrit, et pas de nouvel essai automatique avant 10 min', async () => {
  clerkDown = true;
  const row = addRow({ id: 'u1' });
  assert.equal(await ensureUserEmail(prisma, row), null);
  assert.equal(await ensureUserEmail(prisma, row), null);
  assert.equal(clerkCalls, 1);
  assert.deepEqual(statements, []);
});

await check('deux demandes en même temps : une seule lecture chez Clerk', async () => {
  clerkDelayMs = 30;
  const row = addRow({ id: 'u1' });
  const [first, second] = await Promise.all([ensureUserEmail(prisma, { ...row }), ensureUserEmail(prisma, { ...row })]);
  assert.equal(first, 'paul@example.test');
  assert.equal(second, 'paul@example.test');
  assert.equal(clerkCalls, 1);
});

await check('avant un envoi : Clerk relu même juste après un échec (un e-mail d’événement n’est pas renvoyé)', async () => {
  clerkDown = true;
  const row = addRow({ id: 'u1' });
  assert.equal(await ensureUserEmail(prisma, row), null);
  clerkDown = false;
  assert.equal(await resolveEmailForSending(prisma, row), 'paul@example.test');
  assert.equal(clerkCalls, 2);
});

await check('avant un envoi : adresse changée chez Clerk, remplacée ; puis plus relue pendant une heure', async () => {
  const row = addRow({ id: 'u1', email: 'ancienne@example.test' });
  assert.equal(await resolveEmailForSending(prisma, { ...row }), 'paul@example.test');
  assert.equal(row.email, 'paul@example.test');
  assert.deepEqual(statements, ['replace']);
  assert.equal(await resolveEmailForSending(prisma, { ...row }), 'paul@example.test');
  assert.equal(clerkCalls, 1, 'vérifiée il y a moins d’une heure');
});

await check('avant un envoi : Clerk injoignable, l’adresse en base sert', async () => {
  clerkDown = true;
  assert.equal(await resolveEmailForSending(prisma, addRow({ id: 'u1', email: 'deja@example.test' })), 'deja@example.test');
});

await check('compte clos, compte sans Clerk ou compte Clerk sans adresse : rien', async () => {
  assert.equal(await ensureUserEmail(prisma, addRow({ id: 'u1', deletedAt: new Date() })), null);
  assert.equal(await resolveEmailForSending(prisma, addRow({ id: 'u2', email: 'x@example.test', deletedAt: new Date() })), null);
  assert.equal(await ensureUserEmail(prisma, addRow({ id: 'u3', clerkUserId: null })), null);
  assert.equal(clerkCalls, 0);
  assert.equal(await ensureUserEmail(prisma, addRow({ id: 'u4', clerkUserId: 'user_sans_adresse' })), null);
  assert.deepEqual(statements, []);
});

await check('rattrapage des rappels : seuls les comptes sans adresse sont complétés', async () => {
  addRow({ id: 'u1' });
  addRow({ id: 'u2', clerkUserId: 'user_inconnu' });
  addRow({ id: 'u3', email: 'connue@example.test' });
  assert.equal(await backfillMissingUserEmails(prisma, { limit: 50 }), 1);
  assert.equal(rows.get('u1')?.email, 'paul@example.test');
  assert.equal(rows.get('u2')?.email, null);
  assert.equal(rows.get('u3')?.email, 'connue@example.test');
});

console.log(`✓ ${checks} contrôles de l’adresse e-mail des comptes`);
