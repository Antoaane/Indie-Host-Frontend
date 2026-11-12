// Vérification rapide des alertes de santé des services (`domains/admin/healthAlerts.ts`) : quand un
// e-mail part, quand il ne part pas, et ce qu'il dit. Aussi le bilan de la tâche de référencement des
// sites (`jobs/publicSites.ts`) affiché sur la page Services. Aucune base, aucun envoi.
// Lancer : npx tsx backend/api/scripts/health-smoke.ts
import assert from 'node:assert/strict';

// Les modules chargent la configuration de l'API, qui exige une base : adresse factice, jamais utilisée.
process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';
process.env.BASE_URL = 'https://indiehost.fr';

const {
  HealthAlertPlanner,
  formatOutageDuration,
  readHealthAlertSettings,
  readServiceAlertState,
  renderHealthAlert,
} = await import('../src/domains/admin/healthAlerts.js');
const { assessPublicSitesReport } = await import('../src/jobs/publicSites.js');
type ServiceId = import('../src/domains/admin/systemHealth.js').ServiceId;
type ServiceStatus = import('../src/domains/admin/systemHealth.js').ServiceStatus;
type AlertEvent = import('../src/domains/admin/healthAlerts.js').AlertEvent;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const CONFIRM = 30 * SECOND;
const RECOVERY = 5 * MINUTE;
const GAP = 15 * MINUTE;
const MAX_PER_DAY = 6;
// 12 novembre 2026, 14:00 à Paris.
const T0 = Date.UTC(2026, 10, 12, 13, 0, 0);

function planner() {
  return new HealthAlertPlanner({
    confirmMs: CONFIRM,
    recoveryConfirmMs: RECOVERY,
    minGapMs: GAP,
    maxAlertsPerDay: MAX_PER_DAY,
    degradedAlerts: new Set<ServiceId>(['certificates', 'jobs']),
  });
}

/** Mesures toutes les 30 s pendant `durationMs`, l'état donné par `statusAt` ; renvoie les e-mails décidés. */
function simulate(
  p: InstanceType<typeof HealthAlertPlanner>,
  serviceId: ServiceId,
  statusAt: (at: number) => ServiceStatus,
  durationMs: number,
  options: { from?: number; every?: number } = {},
): AlertEvent[] {
  const from = options.from ?? T0;
  const every = options.every ?? 30 * SECOND;
  const events: AlertEvent[] = [];
  for (let at = from; at < from + durationMs; at += every) {
    events.push(...p.observe(serviceId, 'Service', statusAt(at), 'résumé', at).events);
  }
  return events;
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

check('une coupure d’une seule mesure ne prévient personne', () => {
  const p = planner();
  p.observe('database', 'Base de données', 'up', 'ok', T0);
  const first = p.observe('database', 'Base de données', 'down', 'panne', T0 + 30 * SECOND);
  assert.equal(first.events.length, 0);
  assert.equal(first.probeAt, T0 + 30 * SECOND + CONFIRM, 'remesure pour confirmer');
  const back = p.observe('database', 'Base de données', 'up', 'ok', T0 + 60 * SECOND);
  assert.equal(back.events.length, 0, 'pas de retour annoncé pour une panne jamais signalée');
  assert.equal(p.stateOf('database')?.outageSince, null, 'épisode refermé');
});

check('panne confirmée : un e-mail, puis le retour seulement après 5 min stables', () => {
  const p = planner();
  p.observe('database', 'Base de données', 'up', 'ok', T0);
  p.observe('database', 'Base de données', 'down', 'La base ne répond pas.', T0 + MINUTE);
  const confirmed = p.observe('database', 'Base de données', 'down', 'La base ne répond pas.', T0 + MINUTE + CONFIRM);
  assert.deepEqual(confirmed.events.map((event) => event.kind), ['down']);
  assert.equal(confirmed.events[0]?.since, T0 + MINUTE);
  assert.equal(confirmed.events[0]?.statusSince, T0 + MINUTE, 'se rapporte au changement d’état de la panne');
  assert.equal(p.observe('database', 'Base de données', 'down', 'panne', T0 + 3 * MINUTE).events.length, 0, 'pas de second e-mail');

  const up = p.observe('database', 'Base de données', 'up', 'Répond en 2 ms.', T0 + 9 * MINUTE);
  assert.equal(up.events.length, 0, 'retour pas encore confirmé');
  assert.equal(up.probeAt, T0 + 9 * MINUTE + RECOVERY);
  const back = p.observe('database', 'Base de données', 'up', 'Répond en 2 ms.', T0 + 9 * MINUTE + RECOVERY);
  assert.deepEqual(back.events.map((event) => event.kind), ['recovered']);
  assert.equal(back.events[0]?.since, T0 + MINUTE, 'début de la panne');
  assert.equal(back.events[0]?.statusSince, T0 + 9 * MINUTE, 'fin de la panne = retour du service');
  assert.equal(back.events[0]?.episodeKind, 'down');
});

check('un service qui clignote (1 min de panne toutes les 4 min, 2 h) n’envoie qu’un e-mail', () => {
  const p = planner();
  const events = simulate(p, 'stripe', (at) => ((at - T0) % (4 * MINUTE) < MINUTE ? 'down' : 'up'), 2 * HOUR);
  assert.deepEqual(events.map((event) => event.kind), ['down']);
  // Puis il se stabilise : le retour part une fois, 5 min après la dernière panne.
  const later = simulate(p, 'stripe', () => 'up', 10 * MINUTE, { from: T0 + 2 * HOUR });
  assert.deepEqual(later.map((event) => event.kind), ['recovered']);
});

check('un service qui tombe souvent sur 24 h : au plus 6 alertes de panne, la 6e le dit', () => {
  const p = planner();
  // 2 min de panne toutes les 20 min pendant 24 h : 72 pannes.
  const events = simulate(p, 'scraping', (at) => ((at - T0) % (20 * MINUTE) < 2 * MINUTE ? 'down' : 'up'), 24 * HOUR);
  const downs = events.filter((event) => event.kind === 'down');
  const recovered = events.filter((event) => event.kind === 'recovered');
  assert.equal(downs.length, MAX_PER_DAY, 'plafond');
  assert.equal(recovered.length, MAX_PER_DAY, 'un retour par panne signalée');
  assert.equal(downs.at(-1)?.lastOfDay, true);
  assert.equal(downs.slice(0, -1).some((event) => event.lastOfDay), false);
  const decision = p.observe('scraping', 'Robot d’import', 'down', 'panne', T0 + 24 * HOUR - 10 * SECOND);
  assert.equal(decision.events.length, 0);
});

check('intervalle minimal : une nouvelle panne trop proche attend la fin du quart d’heure', () => {
  const p = planner();
  p.observe('stripe', 'Stripe', 'down', 'panne', T0);
  assert.equal(p.observe('stripe', 'Stripe', 'down', 'panne', T0 + CONFIRM).events.length, 1);
  p.observe('stripe', 'Stripe', 'up', 'ok', T0 + MINUTE);
  assert.equal(p.observe('stripe', 'Stripe', 'up', 'ok', T0 + MINUTE + RECOVERY).events[0]?.kind, 'recovered');
  p.observe('stripe', 'Stripe', 'down', 'panne', T0 + 8 * MINUTE);
  const tooSoon = p.observe('stripe', 'Stripe', 'down', 'panne', T0 + 8 * MINUTE + CONFIRM);
  assert.equal(tooSoon.events.length, 0);
  assert.equal(tooSoon.probeAt, T0 + CONFIRM + GAP, 'remesure prévue à la fin de l’intervalle');
  assert.deepEqual(p.observe('stripe', 'Stripe', 'down', 'panne', T0 + CONFIRM + GAP).events.map((event) => event.kind), ['down']);
});

check('« À surveiller » ne prévient que pour les certificats et les tâches', () => {
  const p = planner();
  const problems = [{ key: 'gite.fr', text: 'gite.fr : expire le 20 nov. (8 j)' }];
  p.observe('certificates', 'Certificats HTTPS', 'degraded', 'Un certificat expire bientôt ou manque.', T0, problems);
  const alert = p.observe('certificates', 'Certificats HTTPS', 'degraded', 'Un certificat expire bientôt ou manque.', T0 + CONFIRM, problems);
  assert.equal(alert.events[0]?.kind, 'degraded');
  assert.deepEqual(alert.events[0]?.problems.map((problem) => problem.key), ['gite.fr']);
  p.observe('stripe', 'Stripe', 'degraded', 'Webhooks manquants', T0);
  assert.equal(p.observe('stripe', 'Stripe', 'degraded', 'Webhooks manquants', T0 + 10 * MINUTE).events.length, 0);
});

check('un nouveau problème sous le même « à surveiller » est signalé, pas les mêmes', () => {
  const p = planner();
  const a = { key: 'gite.fr', text: 'gite.fr : pas de certificat' };
  const b = { key: 'indiehost.fr', text: 'indiehost.fr et ses sous-domaines : expire le 20 nov. (8 j)' };
  p.observe('certificates', 'Certificats HTTPS', 'degraded', 'x', T0, [a]);
  assert.equal(p.observe('certificates', 'Certificats HTTPS', 'degraded', 'x', T0 + CONFIRM, [a]).events.length, 1);
  assert.equal(p.observe('certificates', 'Certificats HTTPS', 'degraded', 'x', T0 + 30 * MINUTE, [a]).events.length, 0, 'mêmes problèmes : rien');
  const grown = p.observe('certificates', 'Certificats HTTPS', 'degraded', 'x', T0 + 60 * MINUTE, [a, b]);
  assert.deepEqual(grown.events.map((event) => event.kind), ['degraded']);
  assert.deepEqual(grown.events[0]?.problems.map((problem) => problem.key), ['indiehost.fr'], 'seul le nouveau est nommé');
});

check('« à surveiller » qui devient une panne est signalé de nouveau', () => {
  const p = planner();
  p.observe('certificates', 'Certificats HTTPS', 'degraded', 'Expire bientôt', T0);
  assert.equal(p.observe('certificates', 'Certificats HTTPS', 'degraded', 'Expire bientôt', T0 + CONFIRM).events.length, 1);
  p.observe('certificates', 'Certificats HTTPS', 'down', 'Expiré', T0 + 20 * MINUTE);
  const escalated = p.observe('certificates', 'Certificats HTTPS', 'down', 'Expiré', T0 + 20 * MINUTE + CONFIRM);
  assert.deepEqual(escalated.events.map((event) => event.kind), ['down']);
  assert.equal(escalated.events[0]?.since, T0, 'même épisode, commencé à « à surveiller »');
});

check('retour vers « à surveiller » sans alerte : le retour le dit', () => {
  const p = planner();
  p.observe('database', 'Base de données', 'down', 'panne', T0);
  p.observe('database', 'Base de données', 'down', 'panne', T0 + CONFIRM);
  p.observe('database', 'Base de données', 'degraded', 'Répond lentement (900 ms).', T0 + 10 * MINUTE);
  const back = p.observe('database', 'Base de données', 'degraded', 'Répond lentement (900 ms).', T0 + 10 * MINUTE + RECOVERY);
  assert.equal(back.events[0]?.kind, 'recovered');
  assert.equal(back.events[0]?.status, 'degraded');
  const mail = renderHealthAlert(back.events, T0 + 10 * MINUTE + RECOVERY);
  assert.match(mail.text, /N’est plus en panne, mais reste à surveiller : Répond lentement \(900 ms\)\./);
  assert.doesNotMatch(mail.text, /Tout est rentré dans l’ordre/);
});

check('« non configuré » et « mesure en cours » ne changent rien', () => {
  const p = planner();
  p.observe('email', 'E-mails', 'down', 'panne', T0);
  assert.equal(p.observe('email', 'E-mails', 'disabled', '—', T0 + 10 * SECOND).events.length, 0);
  assert.equal(p.observe('email', 'E-mails', 'unknown', '—', T0 + 20 * SECOND).events.length, 0);
  assert.equal(p.stateOf('email')?.status, 'down');
  assert.equal(p.observe('email', 'E-mails', 'down', 'panne', T0 + CONFIRM).events[0]?.kind, 'down');
});

check('une alerte qui ne part pas est retentée après l’intervalle et ne compte pas dans le plafond', () => {
  const p = planner();
  p.observe('scraping', 'Robot d’import', 'down', 'panne', T0);
  const sent = p.observe('scraping', 'Robot d’import', 'down', 'panne', T0 + CONFIRM);
  assert.equal(sent.events.length, 1);
  p.markUndelivered(sent.events);
  assert.equal(p.stateOf('scraping')?.alertsSent.length, 0);
  assert.equal(p.observe('scraping', 'Robot d’import', 'down', 'panne', T0 + 2 * MINUTE).events.length, 0);
  assert.equal(p.observe('scraping', 'Robot d’import', 'down', 'panne', T0 + CONFIRM + GAP).events.length, 1);
});

check('un retour qui ne part pas est retenté après l’intervalle, pas perdu', () => {
  const p = planner();
  p.observe('stripe', 'Stripe', 'down', 'panne', T0);
  p.observe('stripe', 'Stripe', 'down', 'panne', T0 + CONFIRM);
  p.observe('stripe', 'Stripe', 'up', 'ok', T0 + 20 * MINUTE);
  const back = p.observe('stripe', 'Stripe', 'up', 'ok', T0 + 20 * MINUTE + RECOVERY);
  assert.equal(back.events[0]?.kind, 'recovered');
  p.markUndelivered(back.events);
  const soon = p.observe('stripe', 'Stripe', 'up', 'ok', T0 + 26 * MINUTE);
  assert.equal(soon.events.length, 0);
  assert.equal(soon.probeAt, T0 + 20 * MINUTE + RECOVERY + GAP);
  const retried = p.observe('stripe', 'Stripe', 'up', 'ok', T0 + 20 * MINUTE + RECOVERY + GAP);
  assert.deepEqual(retried.events.map((event) => event.kind), ['recovered']);
  assert.equal(retried.events[0]?.since, T0, 'même panne');
});

check('l’état survit à un redémarrage : panne pas resignalée, retour annoncé', () => {
  const p = planner();
  p.observe('database', 'Base de données', 'down', 'panne', T0);
  p.observe('database', 'Base de données', 'down', 'panne', T0 + CONFIRM);
  const saved = p.takeDirty();
  assert.deepEqual(saved.map(([serviceId]) => serviceId), ['database']);
  assert.equal(p.takeDirty().length, 0, 'rien de nouveau à écrire');

  // Aller-retour par la base (JSON), puis un nouveau planificateur.
  const restored = readServiceAlertState(JSON.parse(JSON.stringify(saved[0]![1])));
  assert.ok(restored);
  const after = planner();
  after.restore('database', restored);
  assert.equal(after.observe('database', 'Base de données', 'down', 'panne', T0 + 20 * MINUTE).events.length, 0);
  after.observe('database', 'Base de données', 'up', 'ok', T0 + 21 * MINUTE);
  const back = after.observe('database', 'Base de données', 'up', 'ok', T0 + 21 * MINUTE + RECOVERY);
  assert.equal(back.events[0]?.kind, 'recovered');
  assert.equal(back.events[0]?.since, T0);
  assert.equal(readServiceAlertState({ status: 'down' }), null, 'état incomplet refusé');
});

check('durées lisibles', () => {
  assert.equal(formatOutageDuration(20 * SECOND), '1 min');
  assert.equal(formatOutageDuration(7 * MINUTE), '7 min');
  assert.equal(formatOutageDuration(75 * MINUTE), '1 h 15');
  assert.equal(formatOutageDuration(120 * MINUTE), '2 h');
  assert.equal(formatOutageDuration(50 * 60 * MINUTE), '2 jours');
});

check('e-mails : panne, plusieurs pannes, retour, dates, pied de page interne', () => {
  const down: AlertEvent = {
    kind: 'down', serviceId: 'database', label: 'Base de données', summary: 'La base ne répond pas.', status: 'down',
    since: T0, statusSince: T0, at: T0 + CONFIRM, episodeKind: 'down', problems: [], lastOfDay: false,
  };
  const single = renderHealthAlert([down], T0 + CONFIRM);
  assert.equal(single.subject, 'IndieHost : Base de données en panne');
  assert.match(single.text, /La base ne répond pas\. Depuis 14:00\./);
  assert.match(single.text, /dashboard\/admin\?onglet=services/);
  assert.match(single.text, /quand ce service fonctionnera de nouveau/);
  assert.doesNotMatch(single.text, /Répondez simplement/, 'pas le pied de page des hôtes');
  assert.doesNotMatch(single.html, /Conditions générales/);

  const many = renderHealthAlert([down, { ...down, serviceId: 'stripe', label: 'Stripe' }], T0 + CONFIRM);
  assert.equal(many.subject, 'IndieHost : 2 services en panne');
  assert.match(many.text, /quand ces services fonctionneront de nouveau/);

  const recovered = renderHealthAlert([{ ...down, kind: 'recovered', status: 'up', statusSince: T0 + 7 * MINUTE, at: T0 + 12 * MINUTE }], T0 + 12 * MINUTE);
  assert.equal(recovered.subject, 'IndieHost : Base de données de nouveau en service');
  assert.match(recovered.text, /Tout est rentré dans l’ordre/);
  assert.match(recovered.text, /En panne pendant 7 min, de 14:00 à 14:07\./);
  assert.doesNotMatch(recovered.text, /Un autre e-mail partira/);

  const plural = renderHealthAlert([{ ...down, kind: 'recovered', label: 'Cartes', status: 'up', statusSince: T0 + 7 * MINUTE }], T0 + 12 * MINUTE);
  assert.equal(plural.subject, 'IndieHost : Cartes de nouveau en service');

  const overnight = renderHealthAlert(
    [{ ...down, kind: 'recovered', status: 'up', since: T0 - 15 * HOUR, statusSince: T0 + 11 * HOUR }],
    T0 + 11 * HOUR + RECOVERY,
  );
  assert.match(overnight.text, /En panne pendant 26 h, du 11 novembre à 23:00 au 13 novembre à 01:00\./);

  const stillDown = renderHealthAlert(
    [{ ...down, kind: 'recovered', serviceId: 'stripe', label: 'Stripe', status: 'up', statusSince: T0 + 7 * MINUTE }],
    T0 + 12 * MINUTE,
    [{ label: 'Clerk', kind: 'down', since: T0 }],
  );
  assert.doesNotMatch(stillDown.text, /Tout est rentré dans l’ordre/);
  assert.match(stillDown.text, /TOUJOURS SIGNALÉ/);
  assert.match(stillDown.text, /Clerk : En panne depuis 14:00\./);

  const named = renderHealthAlert([{
    ...down, kind: 'degraded', serviceId: 'certificates', label: 'Certificats HTTPS', status: 'degraded',
    summary: 'Un certificat expire bientôt ou manque.', problems: [{ key: 'gite.fr', text: 'gite.fr : pas de certificat.' }], lastOfDay: true,
  }], T0 + CONFIRM);
  assert.equal(named.subject, 'IndieHost : Certificats HTTPS à surveiller');
  assert.match(named.text, /Un certificat expire bientôt ou manque\. gite\.fr : pas de certificat\./);
  assert.match(named.text, /les prochaines alertes de ce service attendront le lendemain/);
});

check('hors production, les alertes ne partent pas et le disent en une phrase', () => {
  const settings = readHealthAlertSettings();
  assert.equal(settings.enabled, false);
  assert.match(settings.reason ?? '', /^Pas d’alerte par e-mail depuis ce serveur : elles ne partent qu’en production\.$/);
});

check('référencement des sites : échec si tout échoue, avertissement si une partie seulement', () => {
  const site = (hostname: string, error?: string) => ({ hostname, urls: 3, actions: ['envoi du sitemap'], ...(error ? { error } : {}) });
  const base = { prefilled: [], searchConsole: true, indexNow: true };
  assert.equal(assessPublicSitesReport({ ...base, sites: [site('a.fr'), { hostname: 'b.fr', urls: 2, actions: [] }] }), null);
  const all = assessPublicSitesReport({ ...base, sites: [site('a.fr', 'clé refusée'), site('b.fr', 'clé refusée'), { hostname: 'c.fr', urls: 1, actions: [] }] });
  assert.equal(all?.error, 'Aucun des 2 sites à traiter n’a abouti (a.fr : clé refusée).');
  const one = assessPublicSitesReport({ ...base, sites: [site('a.fr', 'fichier introuvable'), site('b.fr')] });
  assert.equal(one?.warning, '1 site sur 2 en échec (a.fr : fichier introuvable).');
  assert.equal(one?.error, undefined);
});

console.log(`✓ ${checks} contrôles des alertes de santé`);
