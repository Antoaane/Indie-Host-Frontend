// Aperçu des e-mails voyageurs et hôtes avec des données d'exemple.
//
//   cd backend/api
//   npx tsx src/domains/notifications/preview.cli.ts            # écrit dans <tmp système>/indiehost-mail-preview
//   npx tsx src/domains/notifications/preview.cli.ts --out ./tmp # dossier au choix
//   npx tsx src/domains/notifications/preview.cli.ts --stdout    # imprime le HTML et le texte
//
// Aucune dépendance à la base ni au SMTP : seuls les gabarits sont rendus.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildBookingCancellationEmail } from './bookingCancellation.js';
import { buildBookingConfirmationEmail, type BookingConfirmationEmailData } from './bookingConfirmation.js';
import {
  buildHostCalendarSyncErrorEmail,
  buildHostConnectIncompleteEmail,
  buildHostDraftReminderEmail,
  buildHostListingLimitReachedEmail,
  buildHostListingPublishedEmail,
  buildHostPlanEndingEmail,
  buildHostWelcomeEmail,
  describeListingAllowance,
} from './hostAccountEmails.js';
import {
  buildHostArrivalTomorrowEmail,
  buildHostBookingCanceledEmail,
  buildHostBookingReceivedEmail,
  buildHostDisputeEmail,
  buildHostGuestMessageEmail,
  buildHostRefundFailedEmail,
  buildHostReviewReceivedEmail,
} from './hostBookingEmails.js';

const args = process.argv.slice(2);
const toStdout = args.includes('--stdout');
const outIndex = args.indexOf('--out');
const outDir = outIndex >= 0 && args[outIndex + 1]
  ? path.resolve(args[outIndex + 1] as string)
  : path.join(os.tmpdir(), 'indiehost-mail-preview');

const start = new Date('2026-03-12T00:00:00.000Z');
const end = new Date('2026-03-15T00:00:00.000Z');

const base: BookingConfirmationEmailData = {
  reservationId: 'res_8f3k2m9p',
  listingTitle: 'Gîte Bel Air — vue sur la vallée',
  listingCity: 'Annecy',
  hostName: 'Camille',
  guestName: 'Julien',
  startDate: start,
  endDate: end,
  nights: 3,
  guests: { adults: 2, children: 1, infants: 0, pets: 1, pmr: 0 },
  currency: 'EUR',
  amounts: {
    total: 486,
    paidNow: 146,
    balance: 340,
    balanceMode: 'online',
    balanceDueDateISO: '2026-03-05',
  },
  paymentChoice: 'split',
  paymentMethodLabel: 'En ligne',
  cancellationSettings: { policy: 'moderate', refundsEnabled: true },
  guideUrl: 'https://indiehost.fr/listing/guide/abc123?listingId=lst_42&reservationId=res_8f3k2m9p',
  confirmationUrl: 'https://indiehost.fr/booking/confirmation/res_8f3k2m9p?token=abc123&listingId=lst_42',
  travellerMessage: 'Nous arriverons vers 18 h, avec notre chien (petit, très calme).',
  bookedAt: new Date('2026-02-20T13:42:00.000Z'),
};

const samples = {
  'confirmation-acompte': buildBookingConfirmationEmail(base),
  'confirmation-integral-non-remboursable': buildBookingConfirmationEmail({
    ...base,
    hostName: null,
    guests: { adults: 1, children: 0, infants: 0, pets: 0, pmr: 1 },
    amounts: { total: 486, paidNow: 486, balance: 0, balanceMode: 'none', balanceDueDateISO: null },
    paymentChoice: 'full',
    cancellationSettings: { policy: 'strict', refundsEnabled: false },
    travellerMessage: null,
  }),
  'confirmation-solde-especes': buildBookingConfirmationEmail({
    ...base,
    amounts: { total: 486, paidNow: 146, balance: 340, balanceMode: 'cash', balanceDueDateISO: '2026-03-12' },
    paymentChoice: 'cash',
    cancellationSettings: { policy: 'custom', refundsEnabled: true, custom: { days: 10, feePercent: 25 } },
  }),
  'annulation-voyageur': buildBookingCancellationEmail({
    reservationId: base.reservationId,
    listingTitle: base.listingTitle,
    listingCity: base.listingCity,
    hostName: base.hostName,
    guestName: base.guestName,
    startDate: start,
    endDate: end,
    nights: 3,
    currency: 'EUR',
    canceledBy: 'guest',
    canceledAt: new Date('2026-03-08T09:15:00.000Z'),
    chargedAmount: 146,
    refundedAmount: 116.8,
    retainedAmount: 29.2,
    reason: 'Empêchement professionnel.',
    cancellationSettings: { policy: 'moderate', refundsEnabled: true },
    confirmationUrl: base.confirmationUrl,
  }),
  'annulation-hote': buildBookingCancellationEmail({
    reservationId: base.reservationId,
    listingTitle: base.listingTitle,
    listingCity: base.listingCity,
    hostName: base.hostName,
    guestName: base.guestName,
    startDate: start,
    endDate: end,
    nights: 3,
    currency: 'EUR',
    canceledBy: 'host',
    canceledAt: new Date('2026-03-01T17:00:00.000Z'),
    chargedAmount: 146,
    refundedAmount: 146,
    retainedAmount: 0,
    reason: null,
    cancellationSettings: { policy: 'moderate', refundsEnabled: true },
    confirmationUrl: base.confirmationUrl,
  }),
};

// --- E-mails aux hôtes ---
const site = 'https://indiehost.fr';
const unsubscribeUrl = `${site}/api/v1/notifications/unsubscribe?u=user_1&t=exemple`;
const stay = { listingTitle: base.listingTitle, guestName: base.guestName, startDate: start, endDate: end, nights: 3 };
const contact = { email: 'julien.martin@example.com', phone: '06 12 34 56 78' };
const allowance = describeListingAllowance('indiehost', 2, 2);

Object.assign(samples, {
  'hote-nouvelle-reservation': buildHostBookingReceivedEmail({
    ...stay,
    hostFirstName: 'Camille',
    guests: base.guests,
    contact,
    currency: 'EUR',
    total: 486,
    paidNow: 146,
    balance: 340,
    balanceMode: 'online',
    balanceDueDate: new Date('2026-03-05T00:00:00.000Z'),
    travellerMessage: base.travellerMessage,
    managementUrl: `${site}/dashboard/management`,
  }),
  'hote-annulation-voyageur': buildHostBookingCanceledEmail({
    ...stay,
    hostFirstName: 'Camille',
    canceledBy: 'guest',
    currency: 'EUR',
    chargedAmount: 146,
    refundedAmount: 116.8,
    retainedAmount: 29.2,
    reason: 'Empêchement professionnel.',
    managementUrl: `${site}/dashboard/management`,
  }),
  'hote-annulation-hote': buildHostBookingCanceledEmail({
    ...stay,
    hostFirstName: 'Camille',
    canceledBy: 'host',
    currency: 'EUR',
    chargedAmount: 146,
    refundedAmount: 146,
    retainedAmount: 0,
    reason: null,
    managementUrl: `${site}/dashboard/management`,
  }),
  'hote-arrivee-demain': buildHostArrivalTomorrowEmail({
    ...stay,
    hostFirstName: 'Camille',
    guests: base.guests,
    contact,
    currency: 'EUR',
    balance: 340,
    balanceMode: 'cash',
    travellerMessage: base.travellerMessage,
    messagesUrl: `${site}/dashboard/messages`,
  }),
  'hote-message-voyageur': buildHostGuestMessageEmail({
    hostFirstName: 'Camille',
    guestName: 'Julien',
    listingTitle: base.listingTitle,
    excerpt: 'Bonjour, est-ce qu’il y a un parking à proximité ? Nous arriverons avec deux voitures.',
    stay: { startDate: start, endDate: end },
    messagesUrl: `${site}/dashboard/messages`,
  }),
  'hote-nouvel-avis': buildHostReviewReceivedEmail({
    hostFirstName: 'Camille',
    listingTitle: base.listingTitle,
    author: 'Julien',
    rating: 5,
    text: 'Gîte superbe, très bien équipé, et Camille est aux petits soins. Nous reviendrons !',
    listingUrl: 'https://gite-bel-air.indiehost.fr',
  }),
  'hote-litige': buildHostDisputeEmail({
    hostFirstName: 'Camille',
    listingTitle: base.listingTitle,
    guestName: 'Julien',
    amountMinor: 48600,
    currency: 'eur',
    reason: 'product_not_received',
    evidenceDueBy: new Date('2026-04-02T00:00:00.000Z'),
  }),
  'hote-remboursement-echoue': buildHostRefundFailedEmail({
    hostFirstName: 'Camille',
    listingTitle: base.listingTitle,
    guestName: 'Julien',
    amountMinor: 11680,
    currency: 'eur',
    contact,
    messagesUrl: `${site}/dashboard/messages`,
  }),
  'hote-bienvenue': buildHostWelcomeEmail({
    hostFirstName: 'Camille',
    trialEndDate: new Date('2026-04-12T00:00:00.000Z'),
    paymentsReady: false,
    hasPublishedListing: false,
    activationUrl: `${site}/pricing/callback?onboarding=listing&intent=publish`,
    editorUrl: `${site}/dashboard/editor`,
  }),
  'hote-annonce-en-ligne': buildHostListingPublishedEmail({
    hostFirstName: 'Camille',
    listingTitle: base.listingTitle,
    publicUrl: 'https://gite-bel-air.indiehost.fr',
    limitReached: null,
    dashboardUrl: `${site}/dashboard/editor`,
  }),
  'hote-annonce-en-ligne-derniere-place': buildHostListingPublishedEmail({
    hostFirstName: 'Camille',
    listingTitle: base.listingTitle,
    publicUrl: 'https://gite-bel-air.indiehost.fr',
    limitReached: allowance,
    dashboardUrl: `${site}/dashboard/editor`,
  }),
  'hote-limite-atteinte': buildHostListingLimitReachedEmail({
    hostFirstName: 'Camille',
    allowance,
    dashboardUrl: `${site}/dashboard/editor`,
    unsubscribeUrl,
  }),
  'hote-brouillon': buildHostDraftReminderEmail({
    hostFirstName: 'Camille',
    drafts: [{ title: base.listingTitle, missing: ['quelques photos : vous en avez 2, 5 au moins sont conseillées', 'un prix par nuit'] }],
    accountSteps: ['Activer les paiements : un compte Stripe à votre nom, environ 5 minutes.'],
    step: 1,
    editorUrl: `${site}/dashboard/editor`,
    unsubscribeUrl,
  }),
  'hote-brouillons-dernier-rappel': buildHostDraftReminderEmail({
    hostFirstName: 'Camille',
    drafts: [
      { title: base.listingTitle, missing: [] },
      { title: 'Studio du port', missing: ['des photos (5 au moins sont conseillées)'] },
    ],
    accountSteps: [],
    step: 2,
    editorUrl: `${site}/dashboard/editor`,
    unsubscribeUrl,
  }),
  'hote-paiements-a-activer': buildHostConnectIncompleteEmail({
    hostFirstName: 'Camille',
    started: true,
    activationUrl: `${site}/pricing/callback?onboarding=listing&intent=publish`,
    unsubscribeUrl,
  }),
  'hote-fin-essai': buildHostPlanEndingEmail({
    hostFirstName: 'Camille',
    variant: 'trial_converts',
    endDate: new Date('2026-04-12T00:00:00.000Z'),
    planName: 'IndieHost',
    monthlyAmount: '19,00 €',
    activeListings: 1,
    dashboardUrl: `${site}/dashboard/editor`,
    plansUrl: `${site}/pricing`,
  }),
  'hote-fin-acces-offert': buildHostPlanEndingEmail({
    hostFirstName: 'Camille',
    variant: 'complimentary_ends',
    endDate: new Date('2026-04-12T00:00:00.000Z'),
    planName: null,
    monthlyAmount: null,
    activeListings: 2,
    dashboardUrl: `${site}/dashboard/editor`,
    plansUrl: `${site}/pricing`,
  }),
  'hote-calendrier-en-erreur': buildHostCalendarSyncErrorEmail({
    hostFirstName: 'Camille',
    listingTitle: base.listingTitle,
    calendarName: 'Airbnb',
    editorUrl: `${site}/dashboard/editor`,
  }),
});

if (toStdout) {
  for (const [name, email] of Object.entries(samples)) {
    process.stdout.write(`\n===== ${name} =====\nSujet : ${email.subject}\n\n--- texte ---\n${email.text}\n\n--- html ---\n${email.html}\n`);
  }
} else {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, email] of Object.entries(samples)) {
    fs.writeFileSync(path.join(outDir, `${name}.html`), email.html, 'utf-8');
    fs.writeFileSync(path.join(outDir, `${name}.txt`), `Sujet : ${email.subject}\n\n${email.text}`, 'utf-8');
  }
  process.stdout.write(`Aperçus écrits dans ${outDir}\n`);
  for (const name of Object.keys(samples)) {
    process.stdout.write(`  - ${path.join(outDir, `${name}.html`)}\n`);
  }
}
