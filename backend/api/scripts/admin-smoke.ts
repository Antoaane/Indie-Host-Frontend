// Vérification rapide de l'administration (`domains/admin`) : tickets de la carte du code et droits
// des comptes (rôle lu seulement dans les métadonnées que l'utilisateur ne peut pas modifier).
// Lancer : npx tsx backend/api/scripts/admin-smoke.ts
import assert from 'node:assert/strict';

// Les modules chargent la configuration de l'API, qui exige une base : adresse factice, jamais utilisée.
process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';
process.env.SUPER_ADMIN_EMAILS = ' Dev@IndieHost.fr , ';

const { createFloorplanTicket, isFloorplanTicketValid } = await import('../src/domains/admin/floorplanMap.js');
const { resolveAdminUserAccess } = await import('../src/domains/users/users.service.js');
type ClerkUserProfile = import('../src/lib/clerkUsers.js').ClerkUserProfile;

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

console.log(`✓ ${checks} contrôles de l’administration`);
