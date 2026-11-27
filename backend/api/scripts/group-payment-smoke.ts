// Paiement à plusieurs : contrôle des règles, sans base ni Stripe.
// - les règles du site (`frontend/src/domain/payments/groupPayment.ts`) et de l'API
//   (`domains/bookings/groupPaymentRules.ts`) donnent les mêmes résultats ;
// - parts, conditions, rappels, répartition d'un remboursement, clés des liens, copie JSON.
//
//   cd backend/api && npx tsx --tsconfig ../../frontend/tsconfig.json scripts/group-payment-smoke.ts
//
// `--tsconfig` sert à lire l'alias `@/` des fichiers du site. Le parcours complet, sur la base locale
// et un faux Stripe, est dans `group-payment-flow-smoke.ts`.
import assert from 'node:assert/strict';

// Les modules chargent la configuration de l'API, qui exige une base : adresse factice, jamais utilisée.
process.env.DATABASE_URL ??= 'postgresql://smoke@localhost:5432/smoke';

const api = await import('../src/domains/bookings/groupPaymentRules.js');
const site = await import('../../../frontend/src/domain/payments/groupPayment.js');
const { buildGroupShareKey, parseGroupShareKey } = await import('../src/domains/bookings/groupPaymentKey.js');
const { applyGroupPaymentCopies, applyGroupCopyToPayment, toGroupPaymentCopy } = await import('../src/domains/bookings/groupPaymentCopy.js');
const { maskSensitiveUrl } = await import('../src/app.js');

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

const HOUR = 60 * 60 * 1000;

// 1. Mêmes constantes des deux côtés.
check('constantes identiques', () => {
  assert.equal(site.GROUP_PAYMENT_WINDOW_HOURS, api.GROUP_PAYMENT_WINDOW_HOURS);
  assert.deepEqual([...site.GROUP_PAYMENT_REMINDER_HOURS_BEFORE], [...api.GROUP_PAYMENT_REMINDER_HOURS_BEFORE]);
  assert.equal(site.GROUP_PAYMENT_MIN_LEAD_DAYS, api.GROUP_PAYMENT_MIN_LEAD_DAYS);
  assert.equal(site.GROUP_PAYMENT_MIN_PAYERS, api.GROUP_PAYMENT_MIN_PAYERS);
  assert.equal(site.GROUP_PAYMENT_MAX_PAYERS, api.GROUP_PAYMENT_MAX_PAYERS);
  assert.equal(site.GROUP_PAYMENT_MIN_SHARE_MINOR, api.GROUP_PAYMENT_MIN_SHARE_MINOR);
});

// 2. Parts : la somme vaut le montant, les amis paient la même part, l'organisateur prend l'arrondi.
check('partage du montant', () => {
  let cases = 0;
  for (let total = 1_000; total <= 250_000; total += 997) {
    for (let payers = 2; payers <= 12; payers += 1) {
      const shares = api.splitGroupAmount(total, payers);
      assert.deepEqual(site.splitGroupAmount(total, payers), shares, `${total} en ${payers}`);
      assert.equal(shares.length, payers);
      assert.equal(shares.reduce((sum, share) => sum + share, 0), total, `somme de ${total} en ${payers}`);
      const friends = shares.slice(1);
      assert.ok(friends.every((share) => share === friends[0]), 'amis à parts égales');
      assert.ok((shares[0] ?? 0) - (friends[0] ?? 0) < payers, 'arrondi de l’organisateur inférieur au nombre de parts');
      cases += 1;
    }
  }
  assert.ok(cases > 2_000);
  assert.deepEqual(api.splitGroupAmount(10_000, 3), [3_334, 3_333, 3_333], 'exemple du commentaire');
});

// 3. Conditions d'accès : mêmes réponses sur une grille d'entrées.
check('conditions identiques des deux côtés', () => {
  const today = '2026-11-27';
  for (const enabled of [true, false]) {
    for (const cardAccepted of [true, false]) {
      for (let lead = -1; lead <= 8; lead += 1) {
        const start = new Date(Date.UTC(2026, 10, 27) + lead * 24 * HOUR).toISOString().slice(0, 10);
        for (let adults = 0; adults <= 14; adults += 1) {
          for (const amount of [0, 499, 999, 1_000, 4_999, 25_000, 120_000]) {
            for (const tolerance of [0, 1]) {
              const input = { enabled, cardAccepted, startISO: start, todayISO: today, adults, chargeNowAmountMinor: amount, leadToleranceDays: tolerance };
              assert.deepEqual(site.resolveGroupPaymentOffer(input), api.resolveGroupPaymentOffer(input), JSON.stringify(input));
            }
          }
        }
      }
    }
  }
});

check('conditions : cas lus', () => {
  const base = { enabled: true, cardAccepted: true, startISO: '2026-12-10', todayISO: '2026-11-27', adults: 4, chargeNowAmountMinor: 40_000 };
  assert.deepEqual(api.resolveGroupPaymentOffer(base), { available: true, reason: null, minPayers: 2, maxPayers: 4 });
  assert.equal(api.resolveGroupPaymentOffer({ ...base, enabled: false }).reason, 'disabled');
  assert.equal(api.resolveGroupPaymentOffer({ ...base, cardAccepted: false }).reason, 'card_required');
  assert.equal(api.resolveGroupPaymentOffer({ ...base, startISO: '2026-12-01' }).reason, 'too_close', 'arrivée dans 4 jours');
  assert.equal(api.resolveGroupPaymentOffer({ ...base, startISO: '2026-12-02' }).available, true, 'arrivée dans 5 jours');
  assert.equal(api.resolveGroupPaymentOffer({ ...base, startISO: '2026-12-01', leadToleranceDays: 1 }).available, true, 'marge de l’API');
  assert.equal(api.resolveGroupPaymentOffer({ ...base, adults: 1 }).reason, 'not_enough_adults');
  assert.equal(api.resolveGroupPaymentOffer({ ...base, chargeNowAmountMinor: 900 }).reason, 'amount_too_small');
  assert.equal(api.resolveGroupPaymentOffer({ ...base, chargeNowAmountMinor: 1_500 }).maxPayers, 3, '5 € au moins par part');
  assert.equal(api.resolveGroupPaymentOffer({ ...base, adults: 30 }).maxPayers, 12, 'douze payeurs au plus');
});

check('réglage de l’hôte', () => {
  for (const pricing of [null, {}, { payment: {} }, { payment: { group: {} } }, { payment: { group: { enabled: 'true' } } }, { payment: { group: { enabled: true } } }]) {
    assert.equal(site.isGroupPaymentEnabled(pricing), api.isGroupPaymentEnabled(pricing), JSON.stringify(pricing));
  }
  assert.equal(api.isGroupPaymentEnabled({ payment: { group: { enabled: true } } }), true);
  assert.equal(api.isGroupPaymentEnabled({ payment: { group: { enabled: 'true' } } }), false, 'seul le booléen compte');
});

check('temps restant et adresses', () => {
  for (const ms of [-5, 0, 30_000, 59 * 60_000, HOUR, 2.5 * HOUR, 11 * HOUR + 59 * 60_000, 12 * HOUR + 30 * 60_000, 72 * HOUR]) {
    assert.equal(site.formatGroupTimeLeft(ms), api.formatGroupTimeLeft(ms), String(ms));
  }
  assert.equal(api.formatGroupTimeLeft(2.5 * HOUR), '2 h 30');
  assert.equal(api.formatGroupTimeLeft(48 * HOUR), '48 h');
  assert.equal(api.formatGroupTimeLeft(12 * 60_000), '12 min');
  for (const raw of [' Julie@Exemple.FR ', 'julie@exemple', 'a b@c.fr', '', 'x'.repeat(250) + '@a.fr']) {
    assert.equal(site.normalizeParticipantEmail(raw), api.normalizeParticipantEmail(raw), raw);
  }
  assert.equal(api.normalizeParticipantEmail(' Julie@Exemple.FR '), 'julie@exemple.fr');
});

// 4. Rappels : 48 h, 24 h et 6 h avant l'échéance, un seul par passage, jamais en rafale.
check('rappels', () => {
  const expiresAt = new Date('2026-11-30T12:00:00.000Z');
  const at = (hoursLeft: number) => new Date(expiresAt.getTime() - hoursLeft * HOUR);
  const due = (hoursLeft: number, remindersSent: number) => api.resolveDueGroupReminder({ expiresAt, now: at(hoursLeft), remindersSent });

  assert.equal(due(72, 0), null, 'à la réservation');
  assert.equal(due(48.1, 0), null, 'juste avant 48 h');
  assert.deepEqual(due(48, 0), { stage: 1, hoursLeft: 48 });
  assert.equal(due(47, 1), null, 'déjà envoyé');
  assert.deepEqual(due(24, 1), { stage: 2, hoursLeft: 24 });
  assert.deepEqual(due(5, 0), { stage: 3, hoursLeft: 6 }, 'après une panne, seulement le dernier rappel');
  assert.equal(due(5, 3), null);
  assert.equal(due(0, 0), null, 'échéance passée : plus de rappel');
});

// 5. Annulation d'un séjour confirmé : remboursement réparti sur les parts débitées.
check('répartition d’un remboursement', () => {
  for (const shares of [[3_334, 3_333, 3_333], [12_500, 12_500], [7_001, 7_000, 7_000, 7_000], [500, 500, 500, 500, 500]]) {
    const charged = shares.reduce((sum, share) => sum + share, 0);
    for (const target of [0, 1, 999, Math.floor(charged / 2), charged - 1, charged, charged + 500]) {
      const refunds = api.allocateGroupRefund(shares, target);
      const expected = Math.max(0, Math.min(charged, target));
      assert.equal(refunds.reduce((sum, refund) => sum + refund, 0), expected, `${shares} → ${target}`);
      refunds.forEach((refund, index) => {
        assert.ok(refund >= 0 && refund <= (shares[index] ?? 0), 'jamais plus que la part');
        const fair = ((shares[index] ?? 0) * expected) / charged;
        assert.ok(Math.abs(refund - fair) <= 1, 'au prorata, au centime près');
      });
    }
  }
});

// 6. Liens personnels : signés, sans point (un serveur de développement le prendrait pour une extension).
check('clés de part', () => {
  const key = buildGroupShareKey('cmabc123def456ghi789jkl0');
  assert.match(key, /^gp_[a-z0-9]+_[a-f0-9]{24}$/);
  assert.ok(!key.includes('.'));
  assert.equal(parseGroupShareKey(key), 'cmabc123def456ghi789jkl0');
  assert.equal(parseGroupShareKey(` ${key} `), 'cmabc123def456ghi789jkl0');
  const tampered = key.slice(0, -1) + (key.endsWith('0') ? '1' : '0');
  assert.equal(parseGroupShareKey(tampered), null, 'signature modifiée');
  assert.equal(parseGroupShareKey(key.replace('cmabc', 'cmabd')), null, 'autre part, même signature');
  assert.equal(parseGroupShareKey('rg.reservation-1.abcdef0123456789abcd'), null, 'clé de guide refusée');
  assert.equal(maskSensitiveUrl(`/v1/bookings/group-payments/${key}/confirm`), '/v1/bookings/group-payments/gp_[masqué]/confirm', 'masquée dans les journaux');
});

// 7. Copie JSON de l'état du groupe : le site ne peut ni l'inventer ni la figer.
check('copie de l’état du groupe', () => {
  const group = {
    id: 'grp1',
    status: 'pending',
    payersCount: 3,
    totalAmountMinor: 30_000,
    expiresAt: new Date('2026-11-30T12:00:00.000Z'),
    closeReason: null,
    shares: [{ status: 'authorized' }, { status: 'pending' }, { status: 'authorized' }],
  };
  const copy = toGroupPaymentCopy(group);
  assert.deepEqual(copy, { id: 'grp1', status: 'pending', payers: 3, paidCount: 2, expiresAtISO: '2026-11-30T12:00:00.000Z', totalAmountMinor: 30_000 });
  assert.equal(toGroupPaymentCopy({ ...group, status: 'releasing', closeReason: 'expired' }).status, 'expired');
  assert.equal(toGroupPaymentCopy({ ...group, status: 'capturing' }).status, 'pending');

  const pendingPayment = applyGroupCopyToPayment({ total: 300, status: 'paid', stripe: { status: 'succeeded', deferredAmount: 0 } }, copy);
  assert.equal(pendingPayment.status, 'pending', 'rien de payé tant que le groupe n’est pas complet');
  assert.equal((pendingPayment.stripe as Record<string, unknown>).status, 'requires_capture');

  const completed = applyGroupCopyToPayment({ total: 300, stripe: { deferredAmount: 0 } }, { ...copy, status: 'completed', paidCount: 3 });
  assert.equal(completed.status, 'paid');

  const sent = {
    reservations: [
      // Le site renvoie une copie ancienne, qui prétend le groupe complet.
      { id: 'r1', payment: { status: 'paid', group: { ...copy, status: 'completed', paidCount: 3 } } },
      // Une réservation ordinaire avec un faux groupe inventé par le navigateur.
      { id: 'r2', payment: { status: 'paid', group: { id: 'fake', status: 'completed' } } },
      { id: 'r3', payment: { status: 'paid' } },
    ],
  };
  const fixed = applyGroupPaymentCopies(sent, new Map([['r1', copy]]));
  const rows = fixed.reservations as Array<{ payment: Record<string, unknown> }>;
  assert.equal((rows[0]?.payment.group as Record<string, unknown>).status, 'pending', 'état du serveur rétabli');
  assert.equal(rows[0]?.payment.status, 'pending');
  assert.equal(rows[1]?.payment.group, undefined, 'faux groupe retiré');
  assert.equal(rows[2], sent.reservations[2], 'réservation ordinaire intacte');
});

console.log(`group-payment-smoke : ${checks} contrôles réussis.`);
