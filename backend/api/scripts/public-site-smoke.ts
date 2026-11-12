// Vérification rapide des sites d'hôtes servis par l'API (`domains/publicSite`) : titres et
// descriptions, adresse préférée de chaque annonce, pré-remplissage d'une page principale, HTML servi
// (balises de l'accueil retirées, texte échappé), pied de page, sitemap et robots.txt.
// Lancer : npx tsx backend/api/scripts/public-site-smoke.ts
import assert from 'node:assert/strict';

// Les modules chargent la configuration de l'API, qui exige une base : adresse factice, jamais utilisée.
process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';
process.env.PUBLIC_LISTING_ROOT_DOMAIN = 'indiehost.fr';

const content = await import('../src/domains/publicSite/siteContent.js');
const html = await import('../src/domains/publicSite/html.js');
const { buildPrefilledPage } = await import('../src/domains/publicSite/prefill.js');
const { canonicalLocation } = await import('../src/domains/publicSite/publicSite.service.js');
const { cleanFooterEmail, cleanFooterPhone } = await import('../src/domains/listings/hubPage.js');
type SiteListing = import('../src/domains/publicSite/publicSite.service.js').SiteListing;

let checks = 0;
function check(name: string, run: () => void | Promise<void>) {
  return Promise.resolve(run()).then(() => { checks += 1; }, (error) => {
    console.error(`ÉCHEC : ${name}`);
    throw error;
  });
}

// --- Titres et descriptions ------------------------------------------------------------------

const raisins = {
  title: 'Appartement les Raisins Clairs',
  city: 'Saint-François',
  region: 'Guadeloupe',
  guest_capacity: 3,
  description: '<p>Appartement sécurisé au 1er étage.</p><p>À deux pas de la plage &amp; du marché.</p>',
};

await check('titre d’un logement avec son lieu', () => {
  assert.equal(content.listingSeoTitle(raisins), 'Appartement les Raisins Clairs · Saint-François, Guadeloupe');
});
await check('le lieu n’est pas répété quand le titre le dit (ponctuation ignorée)', () => {
  assert.equal(content.listingSeoTitle({ title: 'Coeur de Saint François', city: 'Saint-François', region: 'Guadeloupe' }), 'Coeur de Saint François · Guadeloupe');
  assert.equal(content.listingSeoTitle({ title: 'Gîte de Saint-François, Guadeloupe', city: 'Saint-François', region: 'Guadeloupe' }), 'Gîte de Saint-François, Guadeloupe');
});
await check('titre d’une page principale avec le lieu de ses logements', () => {
  assert.equal(content.hubSeoTitle({ title: 'Villa Corail' }, 'Saint-François, Guadeloupe'), 'Villa Corail · Saint-François, Guadeloupe');
  assert.equal(content.hubSeoTitle({ title: 'Villa Corail', page: { location: 'Bourg de Saint-François' } }, 'Ailleurs'), 'Villa Corail · Bourg de Saint-François');
});
await check('description tirée du texte, sans balises ni entités', () => {
  assert.equal(content.listingSeoDescription(raisins), 'Appartement sécurisé au 1er étage. À deux pas de la plage & du marché.');
});
await check('description de repli sans texte', () => {
  assert.equal(
    content.listingSeoDescription({ title: 'Gîte', city: 'Annecy', guest_capacity: 6 }),
    'Gîte à Annecy, jusqu’à 6 voyageurs. Réservez en direct auprès de votre hôte.',
  );
});
await check('description coupée à 160 caractères sur un mot entier', () => {
  const long = content.listingSeoDescription({ description: `<p>${'mot '.repeat(80)}</p>` });
  assert.ok(long.length <= 160, `longueur ${long.length}`);
  assert.ok(long.endsWith('mot…'));
});

// --- Adresse préférée --------------------------------------------------------------------------

function listing(partial: Partial<SiteListing> & { id: string }): SiteListing {
  return {
    kind: 'listing',
    status: 'published',
    core: { title: partial.id, slug: partial.id },
    medias: {},
    bookings: {},
    parentListingId: null,
    subdomainSlug: null,
    customDomain: null,
    updatedAt: new Date('2026-11-12T00:00:00Z'),
    ...partial,
  };
}

const hubCustom = listing({ id: 'hub', kind: 'hub', customDomain: 'apparts-saintfrancois.fr', subdomainSlug: 'coeur' });
const childOfCustom = listing({ id: 'raisins', parentListingId: 'hub' });
const hubManaged = listing({ id: 'hub2', kind: 'hub', subdomainSlug: 'villa' });
const childOfManaged = listing({ id: 'corail', parentListingId: 'hub2' });
const hubWithoutHost = listing({ id: 'hub3', kind: 'hub' });
const childWithoutHost = listing({ id: 'perle', parentListingId: 'hub3' });
const aloneOnSub = listing({ id: 'gite', subdomainSlug: 'gite' });
const sharedA = listing({ id: 'chalet-a', subdomainSlug: 'alpes' });
const sharedB = listing({ id: 'chalet-b', subdomainSlug: 'alpes' });
const all = [hubCustom, childOfCustom, hubManaged, childOfManaged, hubWithoutHost, childWithoutHost, aloneOnSub, sharedA, sharedB];
const context = {
  parentOf: async (item: SiteListing) => all.find((candidate) => candidate.id === item.parentListingId) ?? null,
  subdomainMembers: async (subdomain: string) => all.filter((candidate) => candidate.subdomainSlug === subdomain),
};

await check('domaine relié : racine du domaine, avant le sous-domaine', async () => {
  assert.deepEqual(await canonicalLocation(hubCustom, context), { host: 'apparts-saintfrancois.fr', path: '/' });
});
await check('logement d’une page principale : domaine de la page suivi de son nom', async () => {
  assert.deepEqual(await canonicalLocation(childOfCustom, context), { host: 'apparts-saintfrancois.fr', path: '/raisins' });
  assert.deepEqual(await canonicalLocation(childOfManaged, context), { host: 'villa.indiehost.fr', path: '/corail' });
});
await check('page principale sans adresse : indiehost.fr/<nom>', async () => {
  assert.deepEqual(await canonicalLocation(childWithoutHost, context), { host: 'indiehost.fr', path: '/perle' });
});
await check('sous-domaine d’un seul logement : sa racine ; partagé : suivi du nom', async () => {
  assert.deepEqual(await canonicalLocation(aloneOnSub, context), { host: 'gite.indiehost.fr', path: '/' });
  assert.deepEqual(await canonicalLocation(sharedA, context), { host: 'alpes.indiehost.fr', path: '/chalet-a' });
});

// --- Pré-remplissage ------------------------------------------------------------------------------

const savedPage = {
  theme: 'rivage',
  tagline: '',
  location: '',
  sections: [
    { id: 's-note', type: 'rating', title: 'Ce qu’en disent nos voyageurs', platform: 'booking', score: 9.6, reviewCount: 7, label: 'Exceptionnel' },
    { id: 'logements', type: 'listings', title: '' },
  ],
};
const children = [{ core: raisins }];

await check('page enregistrée sans texte : accroche, présentation en tête, pied de page', () => {
  const page = buildPrefilledPage({ core: { title: 'Coeur de Saint François', page: savedPage }, medias: {}, children }, new Date('2026-11-12T10:00:00Z'));
  assert.ok(page);
  assert.equal(page.tagline, 'Location de vacances à Saint-François, Guadeloupe');
  assert.equal(page.sections[0]?.type, 'text');
  assert.equal(page.sections[0]?.title, 'Votre séjour à Saint-François');
  assert.ok(page.sections[0]?.type === 'text' && page.sections[0].text.startsWith('Coeur de Saint François vous accueille à Saint-François, Guadeloupe.'));
  assert.equal(page.sections[1]?.type, 'rating', 'la note Booking est gardée');
  assert.deepEqual(page.footer, { name: 'Coeur de Saint François', text: 'Saint-François, Guadeloupe', email: '', phone: '' });
  assert.equal(page.prefilledAt, '2026-11-12T10:00:00.000Z');
});
await check('une seule fois par page', () => {
  assert.equal(buildPrefilledPage({ core: { title: 'X', page: { ...savedPage, prefilledAt: '2026-11-12T10:00:00.000Z' } }, medias: {}, children }), null);
});
await check('rien sans logement en ligne', () => {
  assert.equal(buildPrefilledPage({ core: { title: 'X', page: savedPage }, medias: {}, children: [] }), null);
});
await check('texte et pied de page de l’hôte jamais remplacés', () => {
  const page = buildPrefilledPage({
    core: {
      title: 'Villa',
      page: {
        ...savedPage,
        tagline: 'Ma phrase',
        footer: { name: 'Villa', text: 'Ma ligne', email: 'moi@villa.fr', phone: '' },
        sections: [{ id: 'a', type: 'text', title: 'Chez nous', text: 'Mon texte.' }, ...savedPage.sections],
      },
    },
    medias: {},
    children,
  });
  assert.ok(page);
  assert.equal(page.tagline, 'Ma phrase');
  assert.equal(page.sections.filter((section) => section.type === 'text').length, 1);
  assert.equal(page.footer?.text, 'Ma ligne');
  assert.equal(page.footer?.email, 'moi@villa.fr');
});
await check('page jamais modifiée : la description de l’annonce reste la présentation', () => {
  const page = buildPrefilledPage({ core: { title: 'Villa', description: '<p>Notre villa.</p>' }, medias: {}, children });
  assert.ok(page);
  assert.equal(page.sections[0]?.type, 'text-image');
  assert.ok(page.sections[0]?.type === 'text-image' && page.sections[0].text === 'Notre villa.');
});

// --- HTML servi --------------------------------------------------------------------------------------

const shell = [
  '<!doctype html><html lang="fr"><head>',
  '<title>IndieHost | Plateforme</title>',
  '<meta\n  name="description"\n  content="Accueil IndieHost"\n/>',
  '<meta name="keywords" content="alternative airbnb" />',
  '<meta property="og:url" content="https://indiehost.fr" />',
  '<link rel="preload" as="image" href="/assets/media/images/webp/hero-image.webp" type="image/webp" />',
  '<link rel="icon" href="/favicon.ico" />',
  '<script type="application/ld+json">{"@type":"SoftwareApplication"}</script>',
  '</head><body><div\n  id="app"\n  class="isolate"\n></div>\n<script type="module" src="/assets/index.js"></script></body></html>',
].join('\n');

await check('les balises de l’accueil disparaissent, celles de la page arrivent', () => {
  const page = html.injectIntoShell(shell, html.renderHead({
    title: 'Villa </title><script>alert(1)</script>',
    description: 'Description "citée"',
    canonical: 'https://villa.fr/',
    noindex: false,
    siteName: 'Villa',
    image: null,
    imageAlt: '',
    jsonLd: [{ '@type': 'WebSite', name: '</script><script>alert(1)</script>' }],
  }), '<p>contenu</p>');
  assert.ok(!page.includes('IndieHost | Plateforme'));
  assert.ok(!page.includes('alternative airbnb'));
  assert.ok(!page.includes('SoftwareApplication'));
  assert.ok(!page.includes('hero-image'));
  assert.ok(page.includes('<link rel="icon" href="/favicon.ico" />'), 'les icônes restent');
  assert.ok(page.includes('<title>Villa &lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>'));
  assert.ok(page.includes('content="Description &quot;citée&quot;"'));
  assert.ok(!page.includes('</script><script>alert(1)'), 'le JSON-LD ne peut pas refermer sa balise');
  assert.ok(/<div id="app"\s+class="isolate"\s*><p>contenu<\/p><\/div>/.test(page));
  assert.ok(page.includes('<script type="module" src="/assets/index.js"></script>'), 'le script du site reste');
});
await check('page 404 : ni canonique ni description vides', () => {
  const head = html.renderHead({ title: 'Page introuvable', description: '', canonical: '', noindex: true, siteName: 'Villa', image: null, imageAlt: '', jsonLd: [] });
  assert.ok(!head.includes('rel="canonical"'));
  assert.ok(!head.includes('name="description"'));
  assert.ok(head.includes('<meta name="robots" content="noindex" data-ih-ssr />'));
});
await check('robots.txt et sitemap du site', () => {
  const robots = html.renderRobots('https://villa.fr', 'Villa');
  assert.ok(robots.includes('Sitemap: https://villa.fr/sitemap.xml'));
  assert.ok(robots.includes('Disallow: /listing/guide/'));
  const sitemap = html.renderSitemap([{ loc: 'https://villa.fr/?a=1&b=2', lastmod: new Date('2026-11-12T00:00:00Z'), images: ['https://ik.imagekit.io/x.jpg'] }]);
  assert.ok(sitemap.includes('<loc>https://villa.fr/?a=1&amp;b=2</loc>'));
  assert.ok(sitemap.includes('<image:image><image:loc>https://ik.imagekit.io/x.jpg</image:loc></image:image>'));
});

// --- Pied de page ---------------------------------------------------------------------------------

await check('e-mail et téléphone du pied de page', () => {
  assert.equal(cleanFooterEmail('  Contact@Villa.FR '), 'contact@villa.fr');
  assert.equal(cleanFooterEmail('pas un e-mail'), '');
  assert.equal(cleanFooterPhone('+590 690 12 34 56'), '+590 690 12 34 56');
  assert.equal(cleanFooterPhone('appelez-moi'), '');
  assert.equal(cleanFooterPhone('12 34'), '', 'au moins six chiffres');
});

console.log(`public-site : ${checks} contrôles réussis.`);
