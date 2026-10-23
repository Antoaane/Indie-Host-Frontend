// Aperçu des e-mails voyageurs avec des données d'exemple.
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
