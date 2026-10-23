// E-mails aux hôtes liés au compte et aux annonces : bienvenue, annonce en ligne, limite de l'offre,
// brouillon à terminer, paiements à activer, fin d'essai ou d'abonnement, calendrier en erreur.
// Fonctions pures (aucun accès base).

import { EXTRA_LISTING_TEMPLATE, PLAN_TEMPLATES, normalizePlanCode } from '../payments/plans.catalog.js';
import type { RenderedEmail } from './bookingConfirmation.js';
import { renderHostEmail, type HostEmailBlock } from './hostEmailKit.js';
import { formatCurrency, formatLongDate, greet, pluralize } from './mailLayout.js';

// --- Bienvenue -------------------------------------------------------------------------------

export type HostWelcomeEmailData = {
  hostFirstName: string | null;
  trialEndDate: Date | null;
  paymentsReady: boolean;
  hasPublishedListing: boolean;
  activationUrl: string;
  editorUrl: string;
};

export function buildHostWelcomeEmail(data: HostWelcomeEmailData): RenderedEmail {
  const done = (ok: boolean) => (ok ? ' (fait)' : '');
  const trial = data.trialEndDate
    ? ` Votre essai gratuit court jusqu’au ${formatLongDate(data.trialEndDate)}.`
    : '';
  const next = !data.paymentsReady
    ? { label: 'Activer les paiements', href: data.activationUrl }
    : { label: 'Ouvrir mon tableau de bord', href: data.editorUrl };

  return renderHostEmail({
    subject: 'Bienvenue sur IndieHost',
    title: 'Bienvenue sur IndieHost',
    preheader: 'Trois étapes pour recevoir vos premières réservations directes.',
    blocks: [
      { kind: 'paragraph', text: `${greet(data.hostFirstName)} merci de votre confiance.${trial}` },
      { kind: 'paragraph', text: 'Trois étapes pour recevoir vos premières réservations, sans commission :' },
      {
        kind: 'list',
        items: [
          `Activer les paiements : un compte Stripe à votre nom, environ 5 minutes${done(data.paymentsReady)}.`,
          `Compléter et publier votre annonce${done(data.hasPublishedListing)}.`,
          'Partager votre lien et ajouter vos calendriers Airbnb ou Booking pour éviter les doubles réservations.',
        ],
      },
      { kind: 'button', ...next },
    ],
  });
}

// --- Annonce en ligne (et limite de l'offre) ------------------------------------------------

export type ListingAllowanceInfo = {
  activeListings: number;
  maxActiveListings: number;
  /** Offre du haut de gamme : pas de montée en gamme à proposer. */
  isTopPlan: boolean;
  extraListingPrice: string;
  upgradeLabel: string | null;
};

/** Offre de l'hôte décrite pour les e-mails (prix de secours du catalogue, alignés sur Stripe). */
export function describeListingAllowance(
  planCode: unknown,
  activeListings: number,
  maxActiveListings: number,
): ListingAllowanceInfo {
  const code = normalizePlanCode(planCode);
  const superhost = PLAN_TEMPLATES.superhost;
  const upgradeLabel = code === 'superhost'
    ? null
    : `Passer à l’offre ${superhost.name} : ${superhost.maxActiveListings} logements inclus pour ${formatCurrency(superhost.defaultMonthlyPriceMinor / 100, 'EUR')} TTC par mois.`;
  return {
    activeListings,
    maxActiveListings,
    isTopPlan: code === 'superhost',
    extraListingPrice: formatCurrency(EXTRA_LISTING_TEMPLATE.defaultMonthlyPriceMinor / 100, 'EUR'),
    upgradeLabel,
  };
}

function allowanceBlocks(info: ListingAllowanceInfo, dashboardUrl: string): HostEmailBlock[] {
  const options = [
    `Ajouter un logement supplémentaire : ${info.extraListingPrice} TTC par mois, depuis votre tableau de bord.`,
    ...(info.isTopPlan || !info.upgradeLabel ? [] : [info.upgradeLabel]),
    'Repasser en brouillon une annonce que vous ne louez plus : elle libère sa place.',
  ];
  return [
    {
      kind: 'paragraph',
      text: `Vous avez ${pluralize(info.activeListings, 'logement')} en ligne sur ${info.maxActiveListings} compris dans votre offre. Vos annonces restent en ligne ; pour en publier une nouvelle, il vous faudra une place de plus :`,
    },
    { kind: 'list', items: options },
    { kind: 'button', label: 'Gérer mes logements', href: dashboardUrl },
  ];
}

export type HostListingPublishedEmailData = {
  hostFirstName: string | null;
  listingTitle: string;
  publicUrl: string;
  /** Renseigné quand cette publication utilise la dernière place de l'offre. */
  limitReached: ListingAllowanceInfo | null;
  dashboardUrl: string;
};

export function buildHostListingPublishedEmail(data: HostListingPublishedEmailData): RenderedEmail {
  const blocks: HostEmailBlock[] = [
    {
      kind: 'paragraph',
      text: `${greet(data.hostFirstName)} « ${data.listingTitle} » est en ligne. Les voyageurs peuvent réserver et payer directement, sans commission.`,
    },
    { kind: 'button', label: 'Voir ma page', href: data.publicUrl },
    { kind: 'section', title: 'Pour vos premières réservations' },
    {
      kind: 'list',
      items: [
        'Partagez ce lien à vos anciens voyageurs, sur vos réseaux et dans votre signature d’e-mail.',
        'Si vous louez aussi sur Airbnb ou Booking, ajoutez leurs liens iCal dans l’éditeur (Réglages, puis iCal) : les dates réservées ailleurs se bloquent ici.',
      ],
    },
  ];

  if (data.limitReached) {
    blocks.push({ kind: 'section', title: 'C’était votre dernier logement disponible' });
    blocks.push(...allowanceBlocks(data.limitReached, data.dashboardUrl));
  }

  return renderHostEmail({
    subject: `Votre annonce est en ligne : ${data.listingTitle}`,
    title: 'Votre annonce est en ligne',
    preheader: data.publicUrl,
    blocks,
  });
}

export type HostListingLimitReachedEmailData = {
  hostFirstName: string | null;
  allowance: ListingAllowanceInfo;
  dashboardUrl: string;
  unsubscribeUrl: string | null;
};

export function buildHostListingLimitReachedEmail(data: HostListingLimitReachedEmailData): RenderedEmail {
  return renderHostEmail({
    subject: 'Vous avez utilisé tous les logements de votre offre',
    title: 'Dernier logement disponible utilisé',
    preheader: `${data.allowance.activeListings} logements en ligne sur ${data.allowance.maxActiveListings}`,
    blocks: [
      { kind: 'paragraph', text: `${greet(data.hostFirstName)} vous venez d’utiliser la dernière place de votre offre.` },
      ...allowanceBlocks(data.allowance, data.dashboardUrl),
    ],
    unsubscribeUrl: data.unsubscribeUrl,
  });
}

// --- Brouillon à terminer --------------------------------------------------------------------

export type DraftListingSummary = {
  title: string;
  /** Ce qu'il manque à l'annonce elle-même (« des photos », « un prix par nuit »…). */
  missing: string[];
};

export type HostDraftReminderEmailData = {
  hostFirstName: string | null;
  drafts: DraftListingSummary[];
  /** Prérequis du compte avant toute publication (offre, paiements). */
  accountSteps: string[];
  /** 1 : premier rappel ; 2 : dernier rappel, avec une offre d'aide. */
  step: 1 | 2;
  editorUrl: string;
  unsubscribeUrl: string | null;
};

export function buildHostDraftReminderEmail(data: HostDraftReminderEmailData): RenderedEmail {
  const single = data.drafts.length === 1 ? data.drafts[0] : null;
  const subject = single
    ? `« ${single.title} » est encore en brouillon`
    : `${data.drafts.length} annonces encore en brouillon`;

  const intro = data.step === 1
    ? `${greet(data.hostFirstName)} ${single ? 'votre annonce attend' : 'vos annonces attendent'} d’être publiée${single ? '' : 's'}. Voici ce qu’il reste à faire.`
    : `${greet(data.hostFirstName)} ${single ? 'votre annonce est toujours' : 'vos annonces sont toujours'} en brouillon. Besoin d’un coup de main ? Répondez à cet e-mail : nous ${single ? 'la' : 'les'} relisons avec vous.`;

  const blocks: HostEmailBlock[] = [{ kind: 'paragraph', text: intro }];

  for (const draft of data.drafts) {
    blocks.push({ kind: 'section', title: draft.title });
    blocks.push(
      draft.missing.length
        ? { kind: 'list', items: draft.missing.map((item) => `Ajouter ${item}`) }
        : { kind: 'paragraph', text: 'Tout est prêt : il ne reste qu’à la publier.' },
    );
  }

  if (data.accountSteps.length) {
    blocks.push({ kind: 'section', title: 'Avant de publier' });
    blocks.push({ kind: 'list', items: data.accountSteps });
  }

  blocks.push({ kind: 'button', label: single ? 'Reprendre mon annonce' : 'Reprendre mes annonces', href: data.editorUrl });

  return renderHostEmail({
    subject,
    title: single ? 'Votre annonce attend d’être publiée' : 'Vos annonces attendent d’être publiées',
    preheader: single ? `${single.missing.length || 'Plus rien'} à compléter` : `${data.drafts.length} brouillons`,
    blocks,
    unsubscribeUrl: data.unsubscribeUrl,
  });
}

// --- Paiements à activer ---------------------------------------------------------------------

export type HostConnectIncompleteEmailData = {
  hostFirstName: string | null;
  /** L'hôte a ouvert l'inscription Stripe sans la terminer. */
  started: boolean;
  activationUrl: string;
  unsubscribeUrl: string | null;
};

export function buildHostConnectIncompleteEmail(data: HostConnectIncompleteEmailData): RenderedEmail {
  const resume = data.started
    ? 'Vous avez commencé l’inscription : vous reprendrez là où vous vous êtes arrêté.'
    : 'Comptez environ 5 minutes : identité, adresse, date de naissance et IBAN.';
  return renderHostEmail({
    subject: 'Activez les paiements pour recevoir vos réservations',
    title: 'Activez les paiements',
    preheader: 'Sans compte de paiement, vos voyageurs ne peuvent pas réserver.',
    blocks: [
      {
        kind: 'paragraph',
        text: `${greet(data.hostFirstName)} votre compte de paiement Stripe n’est pas encore actif : tant qu’il ne l’est pas, vos voyageurs ne peuvent ni réserver ni payer.`,
      },
      { kind: 'paragraph', text: resume },
      { kind: 'button', label: 'Activer les paiements', href: data.activationUrl },
      {
        kind: 'paragraph',
        text: 'Les paiements arrivent directement sur votre compte bancaire ; IndieHost ne prend aucune commission.',
        muted: true,
      },
    ],
    unsubscribeUrl: data.unsubscribeUrl,
  });
}

// --- Fin d'essai, d'abonnement ou d'accès offert -------------------------------------------

export type HostPlanEndingVariant =
  | 'trial_converts'
  | 'trial_ends'
  | 'subscription_ends'
  | 'complimentary_ends';

export type HostPlanEndingEmailData = {
  hostFirstName: string | null;
  variant: HostPlanEndingVariant;
  endDate: Date;
  planName: string | null;
  /** « 19,00 € » : montant mensuel qui sera prélevé (essai converti seulement). */
  monthlyAmount: string | null;
  activeListings: number;
  dashboardUrl: string;
  plansUrl: string;
};

export function buildHostPlanEndingEmail(data: HostPlanEndingEmailData): RenderedEmail {
  const date = formatLongDate(data.endDate);
  const plan = data.planName ? `${data.planName} ` : '';
  const listings = data.activeListings > 0
    ? ` Vous avez ${pluralize(data.activeListings, 'annonce')} en ligne.`
    : '';

  if (data.variant === 'trial_converts') {
    const amount = data.monthlyAmount ? ` : ${data.monthlyAmount} TTC par mois` : '';
    return renderHostEmail({
      subject: `Votre essai gratuit se termine le ${date}`,
      title: 'Votre essai gratuit se termine bientôt',
      preheader: `Votre abonnement ${plan}démarre le ${date}.`,
      blocks: [
        {
          kind: 'paragraph',
          text: `${greet(data.hostFirstName)} votre abonnement ${plan}démarrera automatiquement le ${date}${amount}. Vous n’avez rien à faire.`,
        },
        {
          kind: 'paragraph',
          text: 'Vous pouvez le résilier sans frais jusqu’à cette date, depuis Mon profil (menu de votre avatar).',
        },
        { kind: 'button', label: 'Ouvrir mon tableau de bord', href: data.dashboardUrl },
      ],
    });
  }

  const intro = data.variant === 'complimentary_ends'
    ? `votre accès offert à IndieHost se termine le ${date}.`
    : data.variant === 'trial_ends'
      ? `votre essai gratuit se termine le ${date} et ne sera pas prolongé : vous l’avez résilié.`
      : `votre abonnement ${plan}prend fin le ${date}, comme vous l’avez demandé.`;
  const cta = data.variant === 'complimentary_ends'
    ? { label: 'Choisir une offre', href: data.plansUrl }
    : { label: 'Ouvrir mon tableau de bord', href: data.dashboardUrl };
  const keep = data.variant === 'complimentary_ends'
    ? 'Pour continuer à publier vos annonces sur IndieHost, choisissez une offre avant cette date.'
    : 'Vous avez changé d’avis ? Reprenez votre abonnement depuis Mon profil (menu de votre avatar) avant cette date.';

  return renderHostEmail({
    subject: data.variant === 'complimentary_ends'
      ? `Votre accès offert se termine le ${date}`
      : `Votre abonnement prend fin le ${date}`,
    title: data.variant === 'complimentary_ends' ? 'Votre accès offert se termine' : 'Votre abonnement prend fin',
    preheader: `Fin le ${date}`,
    blocks: [
      { kind: 'paragraph', text: `${greet(data.hostFirstName)} ${intro}${listings}` },
      { kind: 'paragraph', text: keep },
      { kind: 'button', ...cta },
    ],
  });
}

// --- Calendrier externe en erreur ------------------------------------------------------------

export type HostCalendarSyncErrorEmailData = {
  hostFirstName: string | null;
  listingTitle: string;
  calendarName: string | null;
  editorUrl: string;
};

export function buildHostCalendarSyncErrorEmail(data: HostCalendarSyncErrorEmailData): RenderedEmail {
  const calendar = data.calendarName ? `le calendrier « ${data.calendarName} »` : 'un de vos calendriers externes';
  return renderHostEmail({
    subject: `Calendrier non synchronisé : ${data.listingTitle}`,
    title: 'Un calendrier ne se synchronise plus',
    preheader: 'Des dates réservées ailleurs peuvent rester ouvertes sur votre page.',
    blocks: [
      {
        kind: 'paragraph',
        text: `${greet(data.hostFirstName)} nous n’arrivons plus à lire ${calendar} de « ${data.listingTitle} ». Tant que ce n’est pas réglé, des dates réservées ailleurs peuvent rester ouvertes sur votre page.`,
      },
      {
        kind: 'list',
        items: [
          'Vérifiez que le lien iCal est toujours valide : il change si vous le régénérez sur Airbnb ou Booking.',
          'Collez le nouveau lien dans l’éditeur de l’annonce, Réglages puis iCal.',
        ],
      },
      { kind: 'button', label: 'Vérifier mes calendriers', href: data.editorUrl },
    ],
  });
}
