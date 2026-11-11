// Vérification rapide de la section « Note Booking ou Airbnb » de la page de présentation
// (`domains/listings/hubPage.ts`) : validation, bornes de chaque plateforme, nettoyage du texte.
// Lancer : npx tsx backend/api/scripts/hub-page-rating-smoke.ts
import assert from 'node:assert/strict';

// `hubPage.ts` charge la configuration de l'API, qui exige une base : adresse factice, jamais utilisée.
process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';
const { normalizeHubPage, updateHubPageSchema } = await import('../src/domains/listings/hubPage.js');

type RatingInput = { platform?: string; score?: number | null; reviewCount?: number | null; label?: string; title?: string };

function normalizeRating(rating: RatingInput) {
  const input = updateHubPageSchema.parse({
    page: { sections: [{ id: 'note', type: 'rating', ...rating }] },
  });
  const section = normalizeHubPage(input.page).sections[0];
  assert.ok(section && section.type === 'rating', 'la section reste une note');
  return section;
}

// Note réelle d'« Appartement les Raisins Clairs » (Booking, 2026-11-11).
const raisins = normalizeRating({ platform: 'booking', score: 9.6, reviewCount: 7, label: 'Exceptionnel', title: 'Ce qu’en disent nos voyageurs' });
assert.deepEqual(
  { platform: raisins.platform, score: raisins.score, reviewCount: raisins.reviewCount, label: raisins.label },
  { platform: 'booking', score: 9.6, reviewCount: 7, label: 'Exceptionnel' },
  'Booking 9,6, 7 commentaires, Exceptionnel',
);

// Booking : sur 10, une décimale.
assert.equal(normalizeRating({ platform: 'booking', score: 9.64 }).score, 9.6, 'Booking arrondi à une décimale');
assert.equal(normalizeRating({ platform: 'booking', score: 10 }).score, 10, 'Booking 10 accepté');
assert.equal(normalizeRating({ platform: 'booking', score: 10.5 }).score, null, 'Booking au-delà de 10 refusé');
assert.equal(normalizeRating({ platform: 'booking', score: 0.5 }).score, null, 'Booking sous 1 refusé');

// Airbnb : sur 5, deux décimales.
assert.equal(normalizeRating({ platform: 'airbnb', score: 4.923 }).score, 4.92, 'Airbnb arrondi à deux décimales');
assert.equal(normalizeRating({ platform: 'airbnb', score: 9.6 }).score, null, 'une note sur 10 refusée chez Airbnb');

// Plateforme absente : Booking. Plateforme inconnue : refusée.
assert.equal(normalizeRating({ score: 9 }).platform, 'booking', 'plateforme par défaut');
assert.throws(
  () => updateHubPageSchema.parse({ page: { sections: [{ id: 'note', type: 'rating', platform: 'tripadvisor' }] } }),
  'plateforme inconnue refusée',
);

// Commentaires : entier, de 0 à un million.
assert.equal(normalizeRating({ reviewCount: 7.4 }).reviewCount, 7, 'nombre arrondi');
assert.equal(normalizeRating({ reviewCount: -1 }).reviewCount, null, 'nombre négatif refusé');
assert.equal(normalizeRating({ reviewCount: 2_000_000 }).reviewCount, null, 'nombre démesuré refusé');

// Appréciation : texte brut, 40 caractères au plus.
assert.equal(normalizeRating({ label: '<b>Superbe</b>' }).label, 'Superbe', 'appréciation sans balise');
assert.equal(normalizeRating({ label: 'x'.repeat(60) }).label.length, 40, 'appréciation coupée à 40 caractères');

// Une note compte parmi les douze sections ajoutées.
const thirteen = updateHubPageSchema.parse({
  page: { sections: Array.from({ length: 13 }, (_, index) => ({ id: `n${index}`, type: 'rating', score: 9 })) },
});
const kept = normalizeHubPage(thirteen.page).sections.filter((section) => section.type === 'rating');
assert.equal(kept.length, 12, 'douze notes au plus');

console.log('hub-page-rating-smoke : 15 cas OK');
