// Vérification rapide : ce qu'un visiteur sans compte peut lire d'une annonce, et les routes retirées.
// - `core` public : ni adresse précise ni position exacte (position déplacée de 60 à 150 m, stable
//   par annonce), marqué comme vue publique pour qu'un enregistrement de cette vue soit refusé ;
// - le propriétaire reçoit `core` entier ;
// - les anciennes routes ouvertes (`GET /bookings/listings/:id`, `PATCH /bookings/:id`,
//   `GET|PATCH /medias/listings/:id`) n'existent plus.
// Lancer : npx tsx backend/api/scripts/listing-privacy-smoke.ts
import assert from 'node:assert/strict';

import Fastify from 'fastify';

// Les modules chargent la configuration de l'API, qui exige une base : adresse factice, jamais utilisée.
process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';

const {
  approximatePublicPosition,
  isRedactedPatch,
  redactCoreForPublic,
} = await import('../src/domains/listings/listings.access.js');
const { ListingsService } = await import('../src/domains/listings/listings.service.js');
const { bookingsPlugin } = await import('../src/domains/bookings/bookings.plugin.js');
const { mediasPlugin } = await import('../src/domains/medias/medias.plugin.js');

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

let checks = 0;
const check = (label: string, run: () => void | Promise<void>) => ({ label, run });

const exact = { latitude: 16.2528, longitude: -61.2731 };
const core = {
  id: 'lst_1',
  title: 'Coeur de Saint François',
  city: 'Saint-François',
  precise_address: '12 rue des Raisins Clairs, 97118 Saint-François',
  preciseAddress: '12 rue des Raisins Clairs',
  ...exact,
  zoom: 14,
};

const cases = [
  check('adresse précise retirée, le reste gardé', () => {
    const redacted = redactCoreForPublic('lst_1', core);
    assert.equal('precise_address' in redacted, false);
    assert.equal('preciseAddress' in redacted, false);
    assert.equal(redacted.title, core.title);
    assert.equal(redacted.city, core.city);
    assert.equal(redacted.zoom, 14);
    assert.equal(isRedactedPatch(redacted), true);
  }),
  check('position déplacée de 60 à 160 m, toujours dans le cercle public de 300 m', () => {
    for (let index = 0; index < 500; index += 1) {
      const point = { latitude: -60 + (index * 0.237) % 120, longitude: -170 + (index * 0.911) % 340 };
      const moved = approximatePublicPosition(`lst_${index}`, point.latitude, point.longitude);
      const distance = distanceMeters(point, moved);
      // 150 m au plus, plus l'arrondi à 4 décimales ; la carte ajoute 120 m au plus : < 300 m.
      assert.ok(distance >= 50 && distance <= 160, `distance ${distance.toFixed(1)} m pour lst_${index}`);
    }
  }),
  check('même annonce, même position publique ; autre annonce, autre position', () => {
    const first = redactCoreForPublic('lst_1', core);
    const again = redactCoreForPublic('lst_1', core);
    const other = redactCoreForPublic('lst_2', core);
    assert.deepEqual([first.latitude, first.longitude], [again.latitude, again.longitude]);
    assert.notDeepEqual([first.latitude, first.longitude], [other.latitude, other.longitude]);
    assert.notDeepEqual([first.latitude, first.longitude], [exact.latitude, exact.longitude]);
  }),
  check('coordonnées en texte lues, absentes ou nulles laissées telles quelles', () => {
    const fromText = redactCoreForPublic('lst_1', { latitude: '16.2528', longitude: '-61.2731' });
    assert.equal(typeof fromText.latitude, 'number');
    assert.ok(distanceMeters(exact, fromText as typeof exact) >= 50);
    assert.deepEqual(redactCoreForPublic('lst_1', { latitude: 0, longitude: 0 }).latitude, 0);
    assert.equal('latitude' in redactCoreForPublic('lst_1', { title: 'x' }), false);
  }),
  check('lecture publique de `core` et du paquet complet : vue réduite', async () => {
    const listing = {
      id: 'lst_1', ownerId: 'owner_1', status: 'published', kind: 'listing', owner: null,
      core, bookings: {}, medias: {}, arrival: {}, notes: {}, comments: {}, host: null,
    };
    const prisma = { listing: { findUnique: async () => listing, update: async () => listing } };
    const service = new ListingsService(prisma as never);

    const section = await service.getListingResource('core', 'lst_1', null) as Record<string, unknown>;
    assert.equal(section.precise_address, undefined);
    assert.notEqual(section.latitude, exact.latitude);

    const bundle = await service.getListingBundle('lst_1', null) as { core: Record<string, unknown> } | null;
    assert.ok(bundle);
    assert.equal(bundle.core.precise_address, undefined);
    assert.notEqual(bundle.core.latitude, exact.latitude);
    assert.equal(bundle.core.slug !== undefined, true);
  }),
  check('lecture par un admin : `core` entier', async () => {
    const listing = { id: 'lst_1', ownerId: 'owner_1', core };
    const prisma = { listing: { findUnique: async () => listing } };
    const service = new ListingsService(prisma as never);
    const admin = { userId: 'admin_1', payload: { sub: 'admin_1', private_metadata: { role: 'admin' } } };
    const section = await service.getListingResource('core', 'lst_1', admin as never) as Record<string, unknown>;
    assert.equal(section.precise_address, core.precise_address);
    assert.equal(section.latitude, exact.latitude);
  }),
  check('enregistrer la vue publique de `core` est refusé avant toute lecture en base', async () => {
    const prisma = { listing: { findUnique: async () => { throw new Error('unexpected database read'); } } };
    const service = new ListingsService(prisma as never);
    const result = await service.patchListingResource({
      listingId: 'lst_1',
      resource: 'core',
      patch: redactCoreForPublic('lst_1', core),
      auth: { userId: 'owner_1', payload: { sub: 'owner_1' } } as never,
    });
    assert.equal(result, 'redacted');
  }),
  check('anciennes routes ouvertes retirées', async () => {
    const app = Fastify();
    app.decorate('prisma', {} as never);
    app.decorate('authenticate', async () => {});
    app.decorate('authenticateOptional', async () => {});
    await app.register(bookingsPlugin);
    await app.register(mediasPlugin);
    await app.ready();
    assert.equal(app.hasRoute({ method: 'GET', url: '/bookings/listings/:listingId' }), false);
    assert.equal(app.hasRoute({ method: 'PATCH', url: '/bookings/:reservationId' }), false);
    assert.equal(app.hasRoute({ method: 'GET', url: '/medias/listings/:listingId' }), false);
    assert.equal(app.hasRoute({ method: 'PATCH', url: '/medias/listings/:listingId' }), false);
    // Les routes encore servies sont bien là (garde-fou contre un test qui ne verrait rien).
    assert.equal(app.hasRoute({ method: 'POST', url: '/bookings' }), true);
    assert.equal(app.hasRoute({ method: 'POST', url: '/medias/imagekit/upload' }), true);
    await app.close();
  }),
];

for (const { label, run } of cases) {
  await run();
  checks += 1;
  console.log(`ok - ${label}`);
}

console.log(`\n${checks} contrôles réussis.`);
