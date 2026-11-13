// Vérification rapide de l'administration (`domains/admin`) : tickets de la carte du code, droits
// des comptes (rôle lu seulement dans les métadonnées que l'utilisateur ne peut pas modifier) et
// chiffres des paiements (l'argent des réservations, encaissé par les hôtes, n'y entre jamais).
// Lancer : npx tsx backend/api/scripts/admin-smoke.ts
import assert from 'node:assert/strict';

// Les modules chargent la configuration de l'API, qui exige une base : adresse factice, jamais utilisée.
process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';
process.env.SUPER_ADMIN_EMAILS = ' Dev@IndieHost.fr , ';

const { createFloorplanTicket, isFloorplanTicketValid } = await import('../src/domains/admin/floorplanMap.js');
const { assembleAdminPayments } = await import('../src/domains/admin/adminPayments.js');
const { resolveAdminUserAccess } = await import('../src/domains/users/users.service.js');
type ClerkUserProfile = import('../src/lib/clerkUsers.js').ClerkUserProfile;
type AdminPaymentRow = import('../src/domains/admin/adminPayments.js').AdminPaymentRow;

let checks = 0;
function check(name: string, run: () => void) {
  try {
    run();
    checks += 1;
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function clerkUser(patch: Partial<ClerkUserProfile>): ClerkUserProfile {
  return {
    id: 'user_smoke0001',
    email: 'hote@exemple.fr',
    firstName: null,
    lastName: null,
    displayName: null,
    username: null,
    avatarUrl: null,
    privateMetadata: {},
    publicMetadata: {},
    unsafeMetadata: {},
    banned: false,
    locked: false,
    createdAtISO: null,
    lastSignInAtISO: null,
    ...patch,
  };
}

// --- Tickets de la carte du code -----------------------------------------------------------

check('un ticket neuf est valable', () => {
  const { token } = createFloorplanTicket();
  assert.equal(isFloorplanTicketValid(token), true);
});

check('un ticket retouché est refusé', () => {
  const { token } = createFloorplanTicket();
  const last = token.at(-1) === 'A' ? 'B' : 'A';
  assert.equal(isFloorplanTicketValid(`${token.slice(0, -1)}${last}`), false);
  const [expiresAt, nonce, signature] = token.split('.');
  assert.equal(isFloorplanTicketValid(`${Number(expiresAt) + 60_000}.${nonce}.${signature}`), false);
});

check('un ticket expiré est refusé', () => {
  const { token } = createFloorplanTicket();
  const realNow = Date.now;
  Date.now = () => realNow() + 3 * 60 * 1000;
  try {
    assert.equal(isFloorplanTicketValid(token), false);
  } finally {
    Date.now = realNow;
  }
});

check('les valeurs absurdes sont refusées', () => {
  for (const value of [undefined, null, '', 'a.b', 'a.b.c.d', '1.2.3', 'x'.repeat(300), 42]) {
    assert.equal(isFloorplanTicketValid(value), false);
  }
});

// --- Droits des comptes --------------------------------------------------------------------

check('un e-mail de la configuration est administrateur principal, non modifiable', () => {
  const access = resolveAdminUserAccess('dev@indiehost.fr', clerkUser({ email: 'dev@indiehost.fr' }));
  assert.deepEqual([access.role, access.roleSource, access.known], ['super_admin', 'config', true]);
});

check('une adresse absente de la configuration n’est pas administratrice', () => {
  const access = resolveAdminUserAccess('contact@indiehost.fr', clerkUser({ email: 'contact@indiehost.fr' }));
  assert.deepEqual([access.role, access.roleSource], [null, null]);
});

check('la configuration vaut même sans profil Clerk', () => {
  const access = resolveAdminUserAccess('dev@indiehost.fr', null);
  assert.deepEqual([access.role, access.roleSource], ['super_admin', 'config']);
});

check('un rôle en métadonnée privée donne les droits', () => {
  const access = resolveAdminUserAccess('hote@exemple.fr', clerkUser({ privateMetadata: { role: 'admin' } }));
  assert.deepEqual([access.role, access.roleSource], ['admin', 'clerk']);
});

check('un rôle en métadonnée publique donne les droits', () => {
  const access = resolveAdminUserAccess('hote@exemple.fr', clerkUser({ publicMetadata: { role: 'super_admin' } }));
  assert.deepEqual([access.role, access.roleSource], ['super_admin', 'clerk']);
});

check('un rôle posé par l’utilisateur lui-même ne donne rien', () => {
  const access = resolveAdminUserAccess('hote@exemple.fr', clerkUser({ unsafeMetadata: { role: 'admin' } }));
  assert.deepEqual([access.role, access.roleSource, access.known], [null, null, true]);
});

check('un hôte ordinaire n’a pas de rôle', () => {
  const access = resolveAdminUserAccess('hote@exemple.fr', clerkUser({ privateMetadata: { role: 'host' } }));
  assert.equal(access.role, null);
});

check('le blocage et le verrouillage sont repris de Clerk', () => {
  const access = resolveAdminUserAccess('hote@exemple.fr', clerkUser({ banned: true, locked: true }));
  assert.deepEqual([access.banned, access.locked], [true, true]);
});

check('sans profil Clerk, les droits sont inconnus', () => {
  const access = resolveAdminUserAccess('hote@exemple.fr', null);
  assert.deepEqual([access.role, access.known], [null, false]);
});

// --- Paiements : l'argent des réservations n'entre jamais dans les chiffres d'IndieHost --------

const NOW = Date.parse('2026-11-13T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function paymentRow(patch: Partial<AdminPaymentRow> & Pick<AdminPaymentRow, 'id' | 'source' | 'status' | 'amountMinor'>): AdminPaymentRow {
  return {
    refundedMinor: 0,
    currency: 'eur',
    createdAtISO: new Date(NOW - DAY).toISOString(),
    title: 'Paiement',
    detail: null,
    payer: null,
    account: null,
    failureReason: null,
    stripeUrl: null,
    ...patch,
  };
}

const platformRows: AdminPaymentRow[] = [
  paymentRow({ id: 'pi_sub_ok', source: 'subscription', status: 'succeeded', amountMinor: 4_900 }),
  paymentRow({ id: 'pi_sub_refund', source: 'subscription', status: 'partially_refunded', amountMinor: 1_900, refundedMinor: 900 }),
  paymentRow({ id: 'pi_sub_failed', source: 'subscription', status: 'failed', amountMinor: 1_900 }),
  paymentRow({ id: 'pi_sub_old', source: 'subscription', status: 'succeeded', amountMinor: 1_900, createdAtISO: new Date(NOW - 45 * DAY).toISOString() }),
  paymentRow({ id: 'pi_other', source: 'other', status: 'succeeded', amountMinor: 1_000, createdAtISO: new Date(NOW - 2 * DAY).toISOString() }),
];
const reservationRows: AdminPaymentRow[] = [
  paymentRow({ id: 'pay_ok', source: 'reservation', status: 'succeeded', amountMinor: 64_800 }),
  paymentRow({ id: 'pay_failed', source: 'reservation', status: 'failed', amountMinor: 38_400 }),
  paymentRow({ id: 'pay_failed_old', source: 'reservation', status: 'failed', amountMinor: 20_000, createdAtISO: new Date(NOW - 40 * DAY).toISOString() }),
  paymentRow({ id: 'pay_dispute', source: 'reservation', status: 'disputed', amountMinor: 27_500, createdAtISO: new Date(NOW - 50 * DAY).toISOString() }),
  paymentRow({ id: 'pay_refund', source: 'reservation', status: 'refunded', amountMinor: 42_000, refundedMinor: 42_000 }),
];

check('les chiffres d’IndieHost ne comptent que ses propres paiements', () => {
  const payments = assembleAdminPayments(platformRows, reservationRows, NOW);
  assert.ok(payments.platform);
  // 49 € + (19 € − 9 € remboursés) + 10 € sur 30 jours ; ni le paiement de 45 jours ni aucune réservation.
  assert.equal(payments.platform.totals.succeededMinor, 6_900);
  assert.equal(payments.platform.totals.succeededCount, 3);
  assert.equal(payments.platform.totals.failedCount, 1);
  assert.equal(payments.platform.totals.refundedMinor, 900);
  assert.equal(payments.platform.totals.disputedCount, 0);
  assert.ok(payments.platform.rows.every((row) => row.source !== 'reservation'));
});

check('les réservations restent à part, sans total encaissé', () => {
  const payments = assembleAdminPayments(platformRows, reservationRows, NOW);
  assert.deepEqual(Object.keys(payments.reservations).sort(), ['disputedCount', 'failedCount', 'rows']);
  assert.equal(payments.reservations.rows.length, reservationRows.length);
  assert.ok(payments.reservations.rows.every((row) => row.source === 'reservation'));
  // Refus sur 30 jours seulement ; litiges ouverts sur toute la période.
  assert.equal(payments.reservations.failedCount, 1);
  assert.equal(payments.reservations.disputedCount, 1);
});

check('les deux listes sont triées du plus récent au plus ancien', () => {
  const payments = assembleAdminPayments(platformRows, reservationRows, NOW);
  for (const rows of [payments.platform?.rows ?? [], payments.reservations.rows]) {
    const times = rows.map((row) => Date.parse(row.createdAtISO));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  }
});

check('sans Stripe, aucun chiffre d’IndieHost plutôt qu’un zéro trompeur', () => {
  const payments = assembleAdminPayments(null, reservationRows, NOW);
  assert.equal(payments.platform, null);
  assert.equal(payments.reservations.rows.length, reservationRows.length);
});

console.log(`✓ ${checks} contrôles de l’administration`);
