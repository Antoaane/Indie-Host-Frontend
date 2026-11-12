// Vérification rapide : un hôte ne peut viser que son propre compte Stripe Connect (synchronisation,
// lien d'inscription, lien du tableau de bord). Le numéro d'un compte est public : il accompagne chaque
// paiement d'une annonce publiée. Seul le compte rattaché au profil est accepté, et un compte rattaché
// que Stripe dit créé pour un autre utilisateur est refusé à chaque relecture.
// Lancer : npx tsx backend/api/scripts/connect-ownership-smoke.ts
import assert from 'node:assert/strict';

// Les modules chargent la configuration de l'API, qui exige une base : adresse factice, jamais utilisée.
process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';
// Clé factice : aucun appel ne part vers Stripe.
process.env.STRIPE_SECRET_KEY = 'sk_test_smoke_never_called';

const { PaymentsService } = await import('../src/domains/payments/payments.service.js');

type FakeUser = { id: string; stripeConnectAccountId: string | null; stripeConnectProfile: Record<string, unknown> };
type FakeAccount = { id: string; metadata: Record<string, string> };

const stripeCalls: string[] = [];
const service = new PaymentsService({} as never);
const internals = service as unknown as {
  stripe: unknown;
  resolveOwnedConnectAccountId: (user: FakeUser, requested: unknown) => string | null;
  assertConnectAccountOwner: (account: FakeAccount, user: FakeUser) => void;
};
// Un appel à Stripe pendant la résolution serait une régression : le numéro demandé ne se vérifie plus chez Stripe.
internals.stripe = { accounts: { retrieve: async (id: string) => { stripeCalls.push(id); throw new Error('unexpected Stripe call'); } } };

const resolve = (user: FakeUser, requested: unknown) => internals.resolveOwnedConnectAccountId(user, requested);

const host: FakeUser = { id: 'u1', stripeConnectAccountId: 'acct_mine', stripeConnectProfile: {} };
const hostWithoutAccount: FakeUser = { id: 'u1', stripeConnectAccountId: null, stripeConnectProfile: {} };
const hostWithProfileOnly: FakeUser = { id: 'u1', stripeConnectAccountId: null, stripeConnectProfile: { accountId: 'acct_mine' } };

function refused(run: () => unknown) {
  assert.throws(run, (error: { statusCode?: number; code?: string }) => {
    assert.equal(error.statusCode, 403);
    assert.equal(error.code, 'STRIPE_CONNECT_ACCOUNT_NOT_OWNED');
    return true;
  });
}

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

// Les refus sont journalisés : on les tait pendant les contrôles.
const quiet = { warn: console.warn, error: console.error };
console.warn = () => {};
console.error = () => {};
try {
  check('sans numéro demandé, le compte rattaché sert', () => {
    assert.equal(resolve(host, undefined), 'acct_mine');
    assert.equal(resolve(host, '   '), 'acct_mine');
    assert.equal(resolve(hostWithProfileOnly, undefined), 'acct_mine');
    assert.equal(resolve(hostWithoutAccount, undefined), null);
  });

  check('son propre compte est accepté', () => {
    assert.equal(resolve(host, 'acct_mine'), 'acct_mine');
    assert.equal(resolve(hostWithProfileOnly, 'acct_mine'), 'acct_mine');
  });

  check('tout autre numéro est refusé : compte d’un autre hôte, ancien compte, compte inconnu', () => {
    refused(() => resolve(host, 'acct_other'));
    refused(() => resolve(host, 'acct_old_mine'));
    refused(() => resolve(hostWithoutAccount, 'acct_other'));
    refused(() => resolve(hostWithoutAccount, 'acct_does_not_exist'));
  });

  check('la résolution ne demande rien à Stripe', () => {
    assert.deepEqual(stripeCalls, []);
  });

  check('compte relu chez Stripe : créé pour cet utilisateur, accepté', () => {
    internals.assertConnectAccountOwner({ id: 'acct_mine', metadata: { userId: 'u1' } }, host);
  });

  check('compte relu chez Stripe : créé pour un autre utilisateur, refusé', () => {
    refused(() => internals.assertConnectAccountOwner({ id: 'acct_other', metadata: { userId: 'u2' } }, host));
  });

  check('compte sans propriétaire déclaré : accepté, signalé dans les journaux', () => {
    let warned = false;
    console.warn = () => { warned = true; };
    internals.assertConnectAccountOwner({ id: 'acct_legacy', metadata: {} }, host);
    console.warn = () => {};
    assert.equal(warned, true);
  });
} finally {
  console.warn = quiet.warn;
  console.error = quiet.error;
}

console.log(`✓ ${checks} contrôles de propriété des comptes Stripe`);
