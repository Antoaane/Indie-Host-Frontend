// Paiement à plusieurs : le parcours complet sur une vraie base, avec Stripe simulé et les e-mails
// coupés. Une annonce de test est créée puis supprimée (avec ses réservations et ses paiements).
//
//   docker exec -w /app indie-host-frontend-api-1 npx tsx scripts/group-payment-flow-smoke.ts
//
// Ne jamais lancer sur la base de production : le script écrit et supprime des lignes.
import assert from 'node:assert/strict';

// Stripe simulé et aucun e-mail : la configuration lit d'abord ces variables, puis les fichiers.
for (const key of ['STRIPE_SECRET_KEY', 'BREVO_API_KEY', 'SMTP_URL', 'SMTP_HOST']) {
  process.env[key] = '';
  process.env[`${key}_FILE`] = '';
}

const { env } = await import('../src/config/env.js');
const { isMailerConfigured } = await import('../src/lib/mailer.js');
const { createPrismaClient } = await import('../src/lib/prismaClient.js');
const { PaymentsService } = await import('../src/domains/payments/payments.service.js');
const { BookingsService } = await import('../src/domains/bookings/bookings.service.js');
const { GroupBookingsService } = await import('../src/domains/bookings/groupBookings.service.js');
const { GroupPaymentLedger } = await import('../src/domains/bookings/groupPaymentLedger.js');
const { buildGroupShareKey } = await import('../src/domains/bookings/groupPaymentKey.js');
const { buildGuideAccessKey } = await import('../src/lib/guideKey.js');
const { computeReservationTotal, isReservationRangeAvailable } = await import('../src/domains/payments/reservationPricing.js');
type GroupStripeClient = import('../src/domains/bookings/groupPaymentLedger.js').GroupStripeClient;

if (env.NODE_ENV === 'production') throw new Error('Refusé : NODE_ENV=production.');
if (isMailerConfigured()) throw new Error('Refusé : un service d’e-mail est configuré, des e-mails partiraient.');

const prisma = createPrismaClient(env.DATABASE_URL);
const RUN = Date.now().toString(36);
const OWNER_ID = `smoke-group-owner-${RUN}`;
const LISTING_ID = `listing-smoke-group-${RUN}`;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let checks = 0;
async function step(name: string, run: () => Promise<void>) {
  try {
    await run();
    checks += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function isoDay(offsetDays: number): string {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + offsetDays * DAY).toISOString().slice(0, 10);
}

const core = { id: LISTING_ID, title: 'Logement du contrôle', city: 'Saint-François', guest_capacity: 6, status: 'published' };
const bookings = {
  price: 100,
  fees: [],
  'booked-days': [],
  'external-booked-days': [],
  reservations: [],
  pricing: {
    stay: { minNights: 2 },
    payment: { methods: { card: true }, mode: 'full', group: { enabled: true } },
    cancellation: { policy: 'flexible', refundsEnabled: true },
  },
};

async function seed() {
  await prisma.user.create({ data: { id: OWNER_ID, email: null, firstName: 'Hôte', stripeConnectAccountId: `acct_mock_${RUN}` } });
  await prisma.listing.create({
    data: {
      id: LISTING_ID,
      ownerId: OWNER_ID,
      status: 'published',
      core,
      bookings,
      medias: { images: [] },
      arrival: {},
      notes: {},
      comments: {},
    },
  });
}

async function cleanup() {
  await prisma.listing.deleteMany({ where: { id: LISTING_ID } });
  await prisma.user.deleteMany({ where: { id: OWNER_ID } });
}

// Numérotation commune à tous les faux Stripe : les identifiants de paiement sont uniques en base.
let sequence = 0;

/** Faux Stripe : PaymentIntents en mémoire, débit et levée d'une empreinte, remboursements. */
function createFakeStripe() {
  const intents = new Map<string, { id: string; amount: number; amount_capturable: number; currency: string; status: string; client_secret: string }>();
  const refunds: Array<{ payment_intent: string; amount: number }> = [];
  const captures: Array<{ id: string; amount: number }> = [];
  const failures = { captureLost: new Set<string>(), cancelAlreadyCaptured: new Set<string>() };

  const client = {
    paymentIntents: {
      async create(params: { amount: number; currency: string }) {
        sequence += 1;
        const intent = { id: `pi_fake_${sequence}`, amount: params.amount, amount_capturable: 0, currency: params.currency, status: 'requires_payment_method', client_secret: `pi_fake_${sequence}_secret` };
        intents.set(intent.id, intent);
        return { ...intent };
      },
      async retrieve(id: string) {
        const intent = intents.get(id);
        if (!intent) throw new Error(`unknown intent ${id}`);
        return { ...intent };
      },
      async capture(id: string, params?: { amount_to_capture?: number }) {
        const intent = intents.get(id);
        if (!intent) throw new Error(`unknown intent ${id}`);
        const amount = params?.amount_to_capture ?? intent.amount;
        if (amount > intent.amount_capturable && !failures.captureLost.has(id)) throw new Error('amount_to_capture too large');
        if (failures.captureLost.has(id)) {
          intent.status = 'canceled';
          throw new Error('This PaymentIntent could not be captured because it has expired.');
        }
        if (intent.status !== 'requires_capture') throw new Error('unexpected state');
        intent.status = 'succeeded';
        captures.push({ id, amount });
        return { ...intent };
      },
      async cancel(id: string) {
        const intent = intents.get(id);
        if (!intent) throw new Error(`unknown intent ${id}`);
        if (failures.cancelAlreadyCaptured.has(id)) {
          intent.status = 'succeeded';
          throw new Error('You cannot cancel this PaymentIntent because it has a status of succeeded.');
        }
        intent.status = 'canceled';
        return { ...intent };
      },
    },
    refunds: {
      async create(params: { payment_intent: string; amount: number }) {
        refunds.push({ payment_intent: params.payment_intent, amount: params.amount });
        return { id: `re_fake_${refunds.length}`, amount: params.amount };
      },
    },
  };

  return {
    client: client as unknown as GroupStripeClient,
    intents,
    refunds,
    captures,
    failures,
    /** La banque a validé le paiement de l'ami : l'empreinte est posée. */
    authorize(id: string, amount?: number) {
      const existing = intents.get(id);
      if (existing) {
        existing.status = 'requires_capture';
        existing.amount_capturable = existing.amount;
      } else {
        intents.set(id, { id, amount: amount ?? 0, amount_capturable: amount ?? 0, currency: 'eur', status: 'requires_capture', client_secret: `${id}_secret` });
      }
    },
  };
}

function buildServices(stripe: GroupStripeClient | null) {
  const ledger = new GroupPaymentLedger(prisma, { stripe });
  const payments = new PaymentsService(prisma);
  const bookingsService = new BookingsService(prisma, payments, ledger);
  const groups = new GroupBookingsService(prisma, bookingsService, ledger);
  return { ledger, payments, bookings: bookingsService, groups };
}

type Services = ReturnType<typeof buildServices>;

/** Réservation d'un groupe : la part de l'organisateur (PaymentIntent simulé de l'API), puis la réservation. */
async function book(services: Services, input: { startOffset: number; nights: number; payers: number; adults: number }) {
  const startISO = isoDay(input.startOffset);
  const endISO = isoDay(input.startOffset + input.nights);
  const listing = await prisma.listing.findUniqueOrThrow({ where: { id: LISTING_ID } });
  const total = computeReservationTotal({
    core: listing.core as Record<string, unknown>,
    bookings: listing.bookings as Record<string, unknown>,
    startISO,
    endISO,
    occupants: { adults: input.adults, children: 0 },
  });

  const intent = await services.payments.createPaymentIntent({
    listingId: LISTING_ID,
    connectedAccountId: '',
    currency: 'eur',
    reservation: { startISO, endISO, nights: input.nights, total, occupants: { adults: input.adults, children: 0, babies: 0, animals: 0, pmr: 0 } },
    payment: { choice: 'full', totalAmount: total, chargeNowAmount: total, deferredAmount: 0, deferredMode: 'none', deferredDueDateISO: null },
    group: { payers: input.payers },
  }, null);
  assert.ok(intent);

  const created = await services.bookings.createBooking({
    listingId: LISTING_ID,
    start: startISO,
    end: endISO,
    nights: input.nights,
    guestName: 'Camille Martin',
    message: '',
    guests: { adults: input.adults, children: 0, infants: 0, pets: 0 },
    payment: { total, deposit: total, balance: 0, status: 'paid', method: 'En ligne', stripe: { paymentIntentId: intent.id } },
    contact: { firstName: 'Camille', lastName: 'Martin', email: 'camille@exemple.invalid', phone: '0600000000' },
  }, null, { publicBaseUrl: 'http://localhost:5179' });
  assert.ok(created?.groupPayment, 'la réservation renvoie le lien de suivi du groupe');

  const group = await services.ledger.findByReservationId(created.reservationId);
  assert.ok(group);
  return { intent, created, group, startISO, endISO, total };
}

async function listingBookings() {
  const listing = await prisma.listing.findUniqueOrThrow({ where: { id: LISTING_ID }, select: { bookings: true } });
  return listing.bookings as Record<string, unknown>;
}

function listingReservation(bookingsValue: Record<string, unknown>, reservationId: string) {
  const reservations = Array.isArray(bookingsValue.reservations) ? bookingsValue.reservations as Array<Record<string, unknown>> : [];
  return reservations.find((row) => row.id === reservationId) ?? null;
}

async function main() {
  await seed();

  // --- A. Groupe complet, puis annulation remboursée sur les parts --------------------------------
  const mock = buildServices(null);

  await step('conditions vérifiées par l’API', async () => {
    await assert.rejects(() => book(mock, { startOffset: 3, nights: 2, payers: 2, adults: 2 }), /trop proche/);
    await assert.rejects(() => book(mock, { startOffset: 20, nights: 2, payers: 3, adults: 2 }), /de 2 à 2 personnes/);
  });

  const a = await book(mock, { startOffset: 20, nights: 3, payers: 3, adults: 3 });

  await step('réservation en attente : dates bloquées, rien de payé, guide fermé', async () => {
    assert.equal(a.group.status, 'pending');
    assert.equal(a.group.payersCount, 3);
    assert.equal(a.group.totalAmountMinor, a.total * 100);
    assert.deepEqual(a.group.shares.map((share) => share.status), ['authorized', 'pending', 'pending']);
    assert.equal(a.group.shares.reduce((sum, share) => sum + share.amountMinor, 0), a.total * 100);
    assert.equal(a.intent.amountMinor, a.group.shares[0]?.amountMinor, 'le paiement de l’organisateur ne porte que sa part');
    assert.ok(Math.abs(a.group.expiresAt.getTime() - (a.group.createdAt.getTime() + 72 * HOUR)) < 1_000);

    const value = await listingBookings();
    assert.equal(isReservationRangeAvailable(value, a.startISO, a.endISO), false);
    const row = listingReservation(value, a.created.reservationId);
    const payment = row?.payment as Record<string, unknown>;
    assert.equal(payment.status, 'pending');
    assert.equal((payment.group as Record<string, unknown>).status, 'pending');

    const guide = await mock.bookings.getReservationGuideAccess(buildGuideAccessKey(a.created.reservationId, LISTING_ID, new Date(`${a.startISO}T00:00:00.000Z`)));
    assert.ok(guide && guide !== 'forbidden');
    assert.equal(guide.status, 'locked');
  });

  const organizerKey = buildGroupShareKey(a.group.shares[0]!.id);
  const friendKeys = a.group.shares.slice(1).map((share) => buildGroupShareKey(share.id));

  await step('page de l’organisateur et invitations', async () => {
    const page = await mock.groups.getPage(organizerKey);
    assert.ok(page && page !== 'forbidden');
    assert.equal(page.role, 'organizer');
    assert.equal(page.group.paidCount, 1);
    assert.equal(page.actions.canInvite, true);
    assert.equal(page.actions.canPay, false);

    const [first, second] = page.participants.filter((participant) => !participant.isOrganizer);
    assert.ok(first?.shareId && second?.shareId);
    await assert.rejects(
      () => mock.groups.invite(organizerKey, [{ shareId: first.shareId!, email: 'a@exemple.invalid' }, { shareId: second.shareId!, email: 'A@exemple.invalid' }]),
      /propre adresse/,
    );
    const invited = await mock.groups.invite(organizerKey, [
      { shareId: first.shareId!, email: 'julien@exemple.invalid' },
      { shareId: second.shareId!, email: 'sarah@exemple.invalid' },
    ]);
    assert.ok(invited && invited !== 'forbidden');
    const shares = await prisma.groupPaymentShare.findMany({ where: { groupPaymentId: a.group.id }, orderBy: { position: 'asc' } });
    assert.deepEqual(shares.map((share) => share.invitationsSent), [0, 1, 1]);

    // Un ami ne peut pas inviter à la place de l'organisateur.
    assert.equal(await mock.groups.invite(friendKeys[0]!, [{ shareId: first.shareId!, email: 'x@exemple.invalid' }]), 'forbidden');
    // Lien modifié à la main : refusé.
    const tampered = `${organizerKey.slice(0, -1)}${organizerKey.endsWith('0') ? '1' : '0'}`;
    assert.equal(await mock.groups.getPage(tampered), 'forbidden');
  });

  await step('page d’un ami : il ne voit pas les adresses des autres', async () => {
    const page = await mock.groups.getPage(friendKeys[0]!);
    assert.ok(page && page !== 'forbidden');
    assert.equal(page.role, 'participant');
    assert.equal(page.actions.canPay, true);
    assert.ok(page.participants.every((participant) => participant.email === undefined && participant.payPath === undefined));
  });

  await step('les deux amis règlent : groupe débité et réservation confirmée', async () => {
    for (const key of friendKeys) {
      const intent = await mock.groups.createShareIntent(key, { name: 'Ami Test' });
      assert.ok(intent && intent !== 'forbidden' && intent.mock);
      const page = await mock.groups.confirmShare(key);
      assert.ok(page && page !== 'forbidden');
    }
    const group = await mock.ledger.findById(a.group.id);
    assert.equal(group?.status, 'completed');
    assert.deepEqual(group?.shares.map((share) => share.status), ['captured', 'captured', 'captured']);
    const payments = await prisma.payment.findMany({ where: { reservationId: a.created.reservationId } });
    assert.equal(payments.length, 3);
    assert.ok(payments.every((payment) => payment.status === 'succeeded'));

    const row = listingReservation(await listingBookings(), a.created.reservationId);
    const payment = row?.payment as Record<string, unknown>;
    assert.equal(payment.status, 'paid');
    assert.equal((payment.group as Record<string, unknown>).status, 'completed');

    const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: a.created.reservationId } });
    assert.equal(((reservation.payment as Record<string, unknown>).group as Record<string, unknown>).paidCount, 3);
  });

  await step('annulation par le voyageur : remboursement réparti sur les trois parts', async () => {
    const token = buildGuideAccessKey(a.created.reservationId, LISTING_ID, new Date(`${a.startISO}T00:00:00.000Z`));
    const result = await mock.bookings.cancelBooking(a.created.reservationId, token, {});
    assert.ok(result && result !== 'forbidden');
    assert.equal(result.cancellation.status, 'canceled');
    const payments = await prisma.payment.findMany({ where: { reservationId: a.created.reservationId }, orderBy: { createdAt: 'asc' } });
    const refunded = payments.reduce((sum, payment) => sum + (payment.refundedAmountMinor ?? 0), 0);
    assert.equal(refunded, a.total * 100, 'politique souple, 20 jours avant : tout est remboursé');
    assert.ok(payments.every((payment) => payment.status === 'refunded'));
    assert.equal(isReservationRangeAvailable(await listingBookings(), a.startISO, a.endISO), true, 'dates libérées');
  });

  // --- B. Rappels puis délai dépassé : empreintes levées, réservation annulée ----------------------
  const b = await book(mock, { startOffset: 30, nights: 2, payers: 2, adults: 2 });

  await step('rappels : 48 h puis 24 h avant l’échéance, jamais deux fois', async () => {
    const created = b.group.createdAt.getTime();
    await mock.groups.runScheduledPass(new Date(created + 1 * HOUR));
    assert.equal((await mock.ledger.findById(b.group.id))?.remindersSent, 0);
    await mock.groups.runScheduledPass(new Date(created + 25 * HOUR));
    assert.equal((await mock.ledger.findById(b.group.id))?.remindersSent, 1);
    await mock.groups.runScheduledPass(new Date(created + 26 * HOUR));
    assert.equal((await mock.ledger.findById(b.group.id))?.remindersSent, 1);
    await mock.groups.runScheduledPass(new Date(created + 49 * HOUR));
    assert.equal((await mock.ledger.findById(b.group.id))?.remindersSent, 2);
  });

  await step('échéance : réservation annulée, dates libérées, personne débité', async () => {
    const report = await mock.groups.runScheduledPass(new Date(b.group.expiresAt.getTime() + 60_000));
    assert.equal(report.expired, 1);
    const group = await mock.ledger.findById(b.group.id);
    assert.equal(group?.status, 'expired');
    assert.deepEqual(group?.shares.map((share) => share.status), ['released', 'pending']);
    const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: b.created.reservationId } });
    assert.equal(((reservation.payment as Record<string, unknown>).cancellation as Record<string, unknown>).status, 'canceled');
    const value = await listingBookings();
    assert.equal(listingReservation(value, b.created.reservationId), null);
    assert.equal(isReservationRangeAvailable(value, b.startISO, b.endISO), true);

    const page = await mock.groups.getPage(buildGroupShareKey(group!.shares[1]!.id));
    assert.ok(page && page !== 'forbidden');
    assert.equal(page.status, 'expired');
    assert.equal(page.actions.canPay, false);
    await assert.rejects(() => mock.groups.createShareIntent(buildGroupShareKey(group!.shares[1]!.id), {}), /clos/);
  });

  // --- C. L'organisateur annule avant la fin -------------------------------------------------------
  const c = await book(mock, { startOffset: 40, nights: 2, payers: 2, adults: 2 });

  await step('annulation par l’organisateur : empreinte levée, dates libérées', async () => {
    const page = await mock.groups.cancel(buildGroupShareKey(c.group.shares[0]!.id));
    assert.ok(page && page !== 'forbidden');
    assert.equal(page.status, 'canceled');
    assert.equal(page.closeReason, 'organizer');
    assert.equal(isReservationRangeAvailable(await listingBookings(), c.startISO, c.endISO), true);
  });

  // --- D. Faux Stripe : autorisation perdue au débit, levée d'une part déjà débitée ----------------
  const fake = createFakeStripe();
  const real = buildServices(fake.client);
  const d = await book(real, { startOffset: 50, nights: 2, payers: 2, adults: 2 });
  const organizerIntent = d.group.shares[0]!.stripePaymentIntentId!;
  fake.authorize(organizerIntent, d.group.shares[0]!.amountMinor);

  await step('Stripe : empreinte de l’ami, débit groupé', async () => {
    const key = buildGroupShareKey(d.group.shares[1]!.id);
    const intent = await real.groups.createShareIntent(key, { name: 'Julien Bernard' });
    assert.ok(intent && intent !== 'forbidden');
    assert.equal(intent.amountMinor, d.group.shares[1]!.amountMinor);
    // Même part rouverte : le même PaymentIntent resert.
    const again = await real.groups.createShareIntent(key, {});
    assert.ok(again && again !== 'forbidden' && again.paymentIntentId === intent.paymentIntentId);

    // Pas encore validé par la banque : rien ne bouge.
    let page = await real.groups.confirmShare(key);
    assert.ok(page && page !== 'forbidden' && page.group.paidCount === 1);

    // L'autorisation de l'organisateur a expiré entre-temps : sa part est rouverte, rien n'est perdu.
    fake.failures.captureLost.add(organizerIntent);
    fake.authorize(intent.paymentIntentId);
    page = await real.groups.confirmShare(key);
    assert.ok(page && page !== 'forbidden');
    let group = await real.ledger.findById(d.group.id);
    assert.equal(group?.status, 'pending');
    assert.equal(group?.shares[0]?.status, 'pending', 'part de l’organisateur à régler de nouveau');
    assert.equal(group?.shares[1]?.status, 'captured', 'part de l’ami déjà débitée');

    // Le délai passe : la part débitée est remboursée en entier.
    await real.groups.runScheduledPass(new Date(d.group.expiresAt.getTime() + 60_000));
    group = await real.ledger.findById(d.group.id);
    assert.equal(group?.status, 'expired');
    assert.equal(group?.shares[1]?.status, 'refunded');
    assert.deepEqual(fake.refunds.map((refund) => refund.amount), [d.group.shares[1]!.amountMinor]);
  });

  // --- E. Une personne de plus, après qu'un ami a réglé : les parts baissent -----------------------
  const resize = createFakeStripe();
  const r = buildServices(resize.client);
  const e = await book(r, { startOffset: 60, nights: 2, payers: 3, adults: 4 });
  resize.authorize(e.group.shares[0]!.stripePaymentIntentId!, e.group.shares[0]!.amountMinor);
  const eOrganizerKey = buildGroupShareKey(e.group.shares[0]!.id);

  await step('ajout d’une personne : parts recalculées, débit au nouveau montant', async () => {
    const friendKey = buildGroupShareKey(e.group.shares[1]!.id);
    const intent = await r.groups.createShareIntent(friendKey, { name: 'Julien' });
    assert.ok(intent && intent !== 'forbidden');
    resize.authorize(intent.paymentIntentId);
    await r.groups.confirmShare(friendKey);

    let page = await r.groups.getPage(eOrganizerKey);
    assert.ok(page && page !== 'forbidden');
    assert.equal(page.actions.canAddPayer, true, '4 adultes : une quatrième part possible');
    assert.equal(page.actions.canRemovePayer, false, 'retrait fermé : un ami a réglé');
    assert.equal(await r.groups.changePayers(friendKey, { kind: 'add' }), 'forbidden', 'un ami ne change pas le groupe');

    page = await r.groups.changePayers(eOrganizerKey, { kind: 'add' });
    assert.ok(page && page !== 'forbidden');
    assert.equal(page.group.payers, 4);
    const total = e.total * 100;
    const quarter = Math.floor(total / 4);
    let group = await r.ledger.findById(e.group.id);
    assert.deepEqual(group?.shares.map((share) => share.amountMinor), [total - 3 * quarter, quarter, quarter, quarter]);
    assert.deepEqual(group?.shares.map((share) => share.status), ['authorized', 'authorized', 'pending', 'pending']);
    await assert.rejects(() => r.groups.changePayers(eOrganizerKey, { kind: 'add' }), /4 personnes au plus/);
    await assert.rejects(
      () => r.groups.changePayers(eOrganizerKey, { kind: 'remove', shareId: group!.shares[2]!.id }),
      /déjà réglé sa part/,
      'retrait refusé dès qu’un ami a réglé',
    );

    for (const share of group!.shares.slice(2)) {
      const key = buildGroupShareKey(share.id);
      const intent = await r.groups.createShareIntent(key, { name: 'Léa' });
      assert.ok(intent && intent !== 'forbidden');
      assert.equal(intent.amountMinor, quarter);
      resize.authorize(intent.paymentIntentId);
      await r.groups.confirmShare(key);
    }

    group = await r.ledger.findById(e.group.id);
    assert.equal(group?.status, 'completed');
    const captured = resize.captures.map((capture) => capture.amount).sort((a, b) => a - b);
    assert.deepEqual(captured, group!.shares.map((share) => share.amountMinor).sort((a, b) => a - b), 'chaque part débitée à son nouveau montant');
    assert.equal(captured.reduce((sum, amount) => sum + amount, 0), total);
  });

  // --- F. Un ami de moins, personne d'autre n'a réglé : l'organisateur règle de nouveau sa part ----
  const shrink = createFakeStripe();
  const s = buildServices(shrink.client);
  const f = await book(s, { startOffset: 70, nights: 3, payers: 3, adults: 3 });
  const fOrganizerIntent = f.group.shares[0]!.stripePaymentIntentId!;
  shrink.authorize(fOrganizerIntent, f.group.shares[0]!.amountMinor);
  const fOrganizerKey = buildGroupShareKey(f.group.shares[0]!.id);
  const fFriendKey = buildGroupShareKey(f.group.shares[1]!.id);
  const fLeavingKey = buildGroupShareKey(f.group.shares[2]!.id);

  await step('retrait d’un ami : parts en hausse, l’organisateur règle de nouveau', async () => {
    // L'ami restant a ouvert sa page (paiement commencé, pas validé) avant le changement.
    const early = await s.groups.createShareIntent(fFriendKey, {});
    assert.ok(early && early !== 'forbidden');

    const page = await s.groups.changePayers(fOrganizerKey, { kind: 'remove', shareId: f.group.shares[2]!.id });
    assert.ok(page && page !== 'forbidden');
    assert.equal(page.group.payers, 2);
    assert.equal(page.share.status, 'pending', 'part de l’organisateur à régler de nouveau');
    assert.equal(page.actions.canPay, true);
    assert.equal(shrink.intents.get(fOrganizerIntent)?.status, 'canceled', 'ancienne autorisation levée');
    assert.equal(shrink.intents.get(early.paymentIntentId)?.status, 'canceled', 'paiement commencé à l’ancien montant annulé');
    assert.equal(await s.groups.getPage(fLeavingKey), null, 'le lien de l’ami retiré ne mène plus à rien');
    await assert.rejects(() => s.groups.changePayers(fOrganizerKey, { kind: 'remove', shareId: page.participants[1]!.shareId! }), /au moins deux personnes/);

    let group = await s.ledger.findById(f.group.id);
    assert.equal(group?.shares[1]?.stripePaymentIntentId, null);

    const total = f.total * 100;
    for (const key of [fOrganizerKey, fFriendKey]) {
      const intent = await s.groups.createShareIntent(key, {});
      assert.ok(intent && intent !== 'forbidden');
      assert.equal(intent.amountMinor, total / 2);
      shrink.authorize(intent.paymentIntentId);
      await s.groups.confirmShare(key);
    }
    group = await s.ledger.findById(f.group.id);
    assert.equal(group?.status, 'completed');
    assert.deepEqual(shrink.captures.map((capture) => capture.amount), [total / 2, total / 2]);
  });

  await step('ami qui valide un paiement à l’ancien montant après un changement', async () => {
    const g = await book(s, { startOffset: 80, nights: 2, payers: 3, adults: 3 });
    shrink.authorize(g.group.shares[0]!.stripePaymentIntentId!, g.group.shares[0]!.amountMinor);
    const friendKey = buildGroupShareKey(g.group.shares[1]!.id);
    const old = await s.groups.createShareIntent(friendKey, {});
    assert.ok(old && old !== 'forbidden');
    // Le groupe passe à deux : le paiement commencé par l'ami est annulé et retiré de sa part.
    await s.groups.changePayers(buildGroupShareKey(g.group.shares[0]!.id), { kind: 'remove', shareId: g.group.shares[2]!.id });
    const share = (await s.ledger.findById(g.group.id))!.shares[1]!;
    assert.equal(share.stripePaymentIntentId, null);
    // Ancienne page restée ouverte : la banque valide quand même l'ancien paiement, plus petit.
    shrink.authorize(old.paymentIntentId);
    await s.groups.confirmShare(friendKey);
    const after = await s.ledger.findById(g.group.id);
    assert.equal(after?.shares[1]?.status, 'pending', 'part toujours à régler');
    // Le passage planifié ne la compte pas non plus.
    await s.groups.runScheduledPass();
    assert.equal((await s.ledger.findById(g.group.id))?.shares[1]?.status, 'pending');
  });

  console.log(`group-payment-flow-smoke : ${checks} étapes réussies.`);
}

try {
  await main();
} finally {
  await cleanup();
  await prisma.$disconnect();
}
