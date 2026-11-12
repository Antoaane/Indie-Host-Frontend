// Alertes par e-mail de la santé des services : prévenir l'administration quand un service tombe, puis
// quand il revient, sans la noyer ni épuiser le quota d'envoi (Brevo, partagé avec les e-mails aux
// voyageurs et aux hôtes).
//
// - Une panne n'est signalée qu'une fois confirmée : encore là `confirmMs` après la première mesure
//   (la surveillance remesure exprès le service). Une coupure d'une mesure ne réveille personne.
// - Une panne signalée reste ouverte tant que le service n'a pas tenu `recoveryConfirmMs` d'affilée :
//   un service qui clignote n'envoie ni retour ni nouvelle panne, et le retour n'est annoncé qu'une
//   fois le service stable.
// - Au plus un e-mail de panne par service et par `minGapMs`, et `maxAlertsPerDay` par service sur
//   24 h glissantes (le dernier le dit).
// - « À surveiller » ne déclenche un e-mail que pour les services où cet état annonce une panne
//   (certificat qui expire, tâche planifiée en échec), puis de nouveau quand un problème s'ajoute
//   (un autre domaine, une autre tâche) : l'e-mail nomme les problèmes.
// - Un e-mail qui ne part pas est retenté après `minGapMs`, panne comme retour.
// - Les alertes d'un même passage partent dans un seul e-mail.
//
// La décision (`HealthAlertPlanner`) ne fait aucune entrée-sortie : elle est vérifiée par
// `scripts/health-smoke.ts`. Son état s'exporte et se recharge : la surveillance le garde en base
// pour qu'un redémarrage ne resignale pas une panne et annonce bien son retour. L'envoi passe par
// `lib/mailer.ts` (Brevo ou SMTP).

import { env } from '../../config/env.js';
import { isMailerConfigured, resolvePublicBaseUrl, sendMail } from '../../lib/mailer.js';
import { renderHostEmail, type HostEmailBlock } from '../notifications/hostEmailKit.js';
import type { ServiceId, ServiceStatus } from './systemHealth.js';

export type AlertKind = 'down' | 'degraded' | 'recovered';

/** Un problème précis d'un service (un domaine, une tâche) : `key` le reconnaît d'une mesure à l'autre. */
export type AlertProblem = { key: string; text: string };

export type AlertEvent = {
  kind: AlertKind;
  serviceId: ServiceId;
  label: string;
  /** Résumé de la dernière mesure. */
  summary: string;
  /** État mesuré au moment de l'e-mail (pour un retour : en service, ou « à surveiller » sans alerte). */
  status: ServiceStatus;
  /** Début de la panne signalée. */
  since: number;
  /** Début de l'état mesuré : le changement d'état du journal auquel l'e-mail se rapporte. */
  statusSince: number;
  at: number;
  /** Retour : ce qui avait été signalé (panne, ou « à surveiller »). */
  episodeKind: 'down' | 'degraded';
  /** Problèmes à nommer : les nouveaux pour un « à surveiller » qui s'étend, sinon tous. */
  problems: AlertProblem[];
  /** Dernier e-mail de panne possible pour ce service sur 24 h. */
  lastOfDay: boolean;
};

export type AlertPlannerOptions = {
  confirmMs: number;
  recoveryConfirmMs: number;
  minGapMs: number;
  maxAlertsPerDay: number;
  /** Services pour lesquels « À surveiller » mérite un e-mail. */
  degradedAlerts: ReadonlySet<ServiceId>;
};

export type ServiceAlertState = {
  /** Dernier état suivi mesuré, et depuis quand. */
  status: ServiceStatus;
  since: number;
  /** Début de l'épisode en cours (panne, ou « à surveiller » qui alerte) ; null hors épisode. */
  outageSince: number | null;
  /** Un e-mail de panne est parti pour cet épisode et son retour n'est pas encore annoncé. */
  alerted: boolean;
  alertedKind: 'down' | 'degraded' | null;
  /** Clés des problèmes déjà signalés pendant cet épisode. */
  alertedProblems: string[];
  /** Dernier e-mail de panne (envoyé ou tenté) : l'intervalle minimal part de là. */
  lastAlertAt: number | null;
  /** E-mails de panne partis sur les dernières 24 h (plafond). */
  alertsSent: number[];
  /** Retour à annoncer de nouveau à partir de cette heure (le précédent e-mail n'est pas parti). */
  retryAt: number | null;
};

export type PlannerDecision = {
  events: AlertEvent[];
  /** Remesurer ce service à cette heure pour confirmer (ou relancer) une alerte. */
  probeAt: number | null;
  /** Une alerte aurait dû partir, mais le plafond de 24 h est atteint pour ce service. */
  capped?: boolean;
};

const TRACKED: ReadonlySet<ServiceStatus> = new Set(['up', 'degraded', 'down']);
const DAY_MS = 24 * 60 * 60 * 1000;

type Rollback = Pick<ServiceAlertState, 'alerted' | 'alertedKind' | 'alertedProblems' | 'outageSince'>;

function isStatus(value: unknown): value is ServiceStatus {
  return value === 'up' || value === 'degraded' || value === 'down' || value === 'disabled' || value === 'unknown';
}

function readTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** État relu en base : refusé tel quel s'il est incomplet (la surveillance repart alors de zéro). */
export function readServiceAlertState(value: unknown): ServiceAlertState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const since = readTimestamp(raw.since);
  if (!isStatus(raw.status) || since === null) return null;
  const alertedKind = raw.alertedKind === 'down' || raw.alertedKind === 'degraded' ? raw.alertedKind : null;
  return {
    status: raw.status,
    since,
    outageSince: readTimestamp(raw.outageSince),
    alerted: raw.alerted === true && alertedKind !== null,
    alertedKind,
    alertedProblems: Array.isArray(raw.alertedProblems) ? raw.alertedProblems.filter((key): key is string => typeof key === 'string').slice(0, 50) : [],
    lastAlertAt: readTimestamp(raw.lastAlertAt),
    alertsSent: Array.isArray(raw.alertsSent) ? raw.alertsSent.filter((at): at is number => typeof at === 'number' && Number.isFinite(at)).slice(-50) : [],
    retryAt: readTimestamp(raw.retryAt),
  };
}

export class HealthAlertPlanner {
  private readonly states = new Map<ServiceId, ServiceAlertState>();
  private readonly dirty = new Set<ServiceId>();
  private readonly rollbacks = new WeakMap<AlertEvent, Rollback>();

  constructor(private readonly options: AlertPlannerOptions) {}

  /** État retrouvé au démarrage. */
  restore(serviceId: ServiceId, state: ServiceAlertState): void {
    this.states.set(serviceId, { ...state, alertedProblems: [...state.alertedProblems], alertsSent: [...state.alertsSent] });
  }

  stateOf(serviceId: ServiceId): ServiceAlertState | null {
    const state = this.states.get(serviceId);
    return state ? { ...state, alertedProblems: [...state.alertedProblems], alertsSent: [...state.alertsSent] } : null;
  }

  /** États modifiés depuis le dernier appel, à écrire en base. */
  takeDirty(): Array<[ServiceId, ServiceAlertState]> {
    const entries: Array<[ServiceId, ServiceAlertState]> = [];
    for (const serviceId of this.dirty) {
      const state = this.stateOf(serviceId);
      if (state) entries.push([serviceId, state]);
    }
    this.dirty.clear();
    return entries;
  }

  /** L'écriture a échoué : ces états seront réécrits au passage suivant. */
  markDirty(serviceIds: Iterable<ServiceId>): void {
    for (const serviceId of serviceIds) this.dirty.add(serviceId);
  }

  /** Pannes signalées dont le retour n'est pas encore annoncé (rappelées dans un e-mail de retour). */
  openAlerts(): Array<{ serviceId: ServiceId; kind: 'down' | 'degraded'; since: number }> {
    const open: Array<{ serviceId: ServiceId; kind: 'down' | 'degraded'; since: number }> = [];
    for (const [serviceId, state] of this.states) {
      if (state.alerted && state.alertedKind && state.outageSince !== null) open.push({ serviceId, kind: state.alertedKind, since: state.outageSince });
    }
    return open;
  }

  private alertable(serviceId: ServiceId, status: ServiceStatus): boolean {
    return status === 'down' || (status === 'degraded' && this.options.degradedAlerts.has(serviceId));
  }

  /** Une mesure vient d'arriver : faut-il prévenir, ou remesurer bientôt ? */
  observe(serviceId: ServiceId, label: string, status: ServiceStatus, summary: string, now: number, problems: AlertProblem[] = []): PlannerDecision {
    // « Non configuré » ou « mesure en cours » : rien à décider, l'état connu ne change pas.
    if (!TRACKED.has(status)) return { events: [], probeAt: null };

    let state = this.states.get(serviceId);
    if (!state) {
      state = { status, since: now, outageSince: null, alerted: false, alertedKind: null, alertedProblems: [], lastAlertAt: null, alertsSent: [], retryAt: null };
      this.states.set(serviceId, state);
      this.dirty.add(serviceId);
    } else if (state.status !== status) {
      state.status = status;
      state.since = now;
      this.dirty.add(serviceId);
    }

    return this.alertable(serviceId, status)
      ? this.observeProblem(state, serviceId, label, status, summary, now, problems)
      : this.observeHealthy(state, serviceId, label, status, summary, now);
  }

  private observeProblem(
    state: ServiceAlertState,
    serviceId: ServiceId,
    label: string,
    status: ServiceStatus,
    summary: string,
    now: number,
    problems: AlertProblem[],
  ): PlannerDecision {
    if (state.outageSince === null) {
      state.outageSince = state.since;
      this.dirty.add(serviceId);
    }
    // Un retour restait à annoncer : le service est retombé, c'est la même panne qui continue.
    if (state.retryAt !== null) {
      state.retryAt = null;
      this.dirty.add(serviceId);
    }

    const kind: 'down' | 'degraded' = status === 'down' ? 'down' : 'degraded';
    const known = new Set(state.alertedProblems);
    const fresh = problems.filter((problem) => !known.has(problem.key));
    const escalated = state.alerted && state.alertedKind === 'degraded' && kind === 'down';
    const grown = state.alerted && kind === 'degraded' && fresh.length > 0;
    if (state.alerted && !escalated && !grown) return { events: [], probeAt: null };

    // Pas encore confirmé : la mesure suivante dira si ça dure.
    const confirmAt = state.since + this.options.confirmMs;
    if (now < confirmAt) return { events: [], probeAt: confirmAt };

    // Un e-mail récent pour ce service : on attend la fin de l'intervalle, puis on prévient si ça dure.
    if (state.lastAlertAt !== null && now - state.lastAlertAt < this.options.minGapMs) {
      return { events: [], probeAt: state.lastAlertAt + this.options.minGapMs };
    }

    state.alertsSent = state.alertsSent.filter((at) => now - at < DAY_MS);
    if (state.alertsSent.length >= this.options.maxAlertsPerDay) return { events: [], probeAt: null, capped: true };

    const event: AlertEvent = {
      kind,
      serviceId,
      label,
      summary,
      status,
      since: state.outageSince ?? state.since,
      statusSince: state.since,
      at: now,
      episodeKind: kind,
      problems: grown ? fresh : problems,
      lastOfDay: state.alertsSent.length + 1 >= this.options.maxAlertsPerDay,
    };
    this.rollbacks.set(event, {
      alerted: state.alerted,
      alertedKind: state.alertedKind,
      alertedProblems: [...state.alertedProblems],
      outageSince: state.outageSince,
    });
    state.alerted = true;
    state.alertedKind = escalated || !state.alertedKind ? kind : state.alertedKind;
    state.alertedProblems = [...new Set([...state.alertedProblems, ...problems.map((problem) => problem.key)])];
    state.lastAlertAt = now;
    state.alertsSent.push(now);
    this.dirty.add(serviceId);
    return { events: [event], probeAt: null };
  }

  private observeHealthy(
    state: ServiceAlertState,
    serviceId: ServiceId,
    label: string,
    status: ServiceStatus,
    summary: string,
    now: number,
  ): PlannerDecision {
    if (state.outageSince === null) return { events: [], probeAt: null };

    if (!state.alerted) {
      // Épisode jamais signalé (coupure brève, plafond atteint) : il se referme sans rien dire.
      state.outageSince = null;
      state.alertedKind = null;
      state.alertedProblems = [];
      this.dirty.add(serviceId);
      return { events: [], probeAt: null };
    }

    // Le retour n'est annoncé qu'après `recoveryConfirmMs` sans problème d'affilée.
    const confirmAt = state.since + this.options.recoveryConfirmMs;
    if (now < confirmAt) return { events: [], probeAt: confirmAt };
    if (state.retryAt !== null && now < state.retryAt) return { events: [], probeAt: state.retryAt };

    const event: AlertEvent = {
      kind: 'recovered',
      serviceId,
      label,
      summary,
      status,
      since: state.outageSince,
      statusSince: state.since,
      at: now,
      episodeKind: state.alertedKind ?? 'down',
      problems: [],
      lastOfDay: false,
    };
    this.rollbacks.set(event, {
      alerted: state.alerted,
      alertedKind: state.alertedKind,
      alertedProblems: [...state.alertedProblems],
      outageSince: state.outageSince,
    });
    state.alerted = false;
    state.alertedKind = null;
    state.alertedProblems = [];
    state.outageSince = null;
    state.retryAt = null;
    this.dirty.add(serviceId);
    return { events: [event], probeAt: null };
  }

  /**
   * L'e-mail n'a pas pu partir. Une panne redevient « à signaler » : elle sera retentée à la fin de
   * l'intervalle (pas à chaque mesure quand le service d'envoi est lui-même en panne) et ne compte pas
   * dans le plafond. Un retour reste dû : il est retenté après l'intervalle si le service tient.
   */
  markUndelivered(events: AlertEvent[]): void {
    for (const event of events) {
      const state = this.states.get(event.serviceId);
      const rollback = this.rollbacks.get(event);
      if (!state || !rollback) continue;
      state.alerted = rollback.alerted;
      state.alertedKind = rollback.alertedKind;
      state.alertedProblems = rollback.alertedProblems;
      state.outageSince = rollback.outageSince;
      if (event.kind === 'recovered') {
        state.retryAt = event.at + this.options.minGapMs;
      } else {
        state.alertsSent = state.alertsSent.filter((at) => at !== event.at);
      }
      this.dirty.add(event.serviceId);
    }
  }
}

// --- Envoi -----------------------------------------------------------------------------------

export type HealthAlertSettings = {
  enabled: boolean;
  recipients: string[];
  /** Pourquoi les alertes ne partent pas, en une phrase (null si elles partent). */
  reason: string | null;
};

function parseEmails(value: string): string[] {
  return [...new Set(value.split(',').map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.includes('@')))];
}

export function readHealthAlertSettings(): HealthAlertSettings {
  const recipients = parseEmails(env.HEALTH_ALERT_EMAILS || env.SUPER_ADMIN_EMAILS);
  if (!env.HEALTH_ALERTS_ENABLED) return { enabled: false, recipients, reason: 'Alertes par e-mail coupées par la configuration du serveur (HEALTH_ALERTS_ENABLED=false).' };
  if (env.NODE_ENV !== 'production') return { enabled: false, recipients, reason: 'Pas d’alerte par e-mail depuis ce serveur : elles ne partent qu’en production.' };
  if (!recipients.length) return { enabled: false, recipients, reason: 'Pas d’alerte par e-mail : aucun destinataire (renseignez HEALTH_ALERT_EMAILS ou SUPER_ADMIN_EMAILS).' };
  if (!isMailerConfigured()) return { enabled: false, recipients, reason: 'Pas d’alerte par e-mail : aucun service d’envoi d’e-mails n’est configuré sur ce serveur.' };
  return { enabled: true, recipients, reason: null };
}

const TIME_ZONE = 'Europe/Paris';
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: TIME_ZONE });
const dayKeyFormatter = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE });

export function formatOutageDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
  return `${Math.round(hours / 24)} jours`;
}

function sameDay(a: number, b: number): boolean {
  return dayKeyFormatter.format(a) === dayKeyFormatter.format(b);
}

function formatDayAndTime(at: number): string {
  return `${dayFormatter.format(at)} à ${timeFormatter.format(at)}`;
}

/** « 14:05 » le jour même, sinon « le 12 novembre à 23:50 » (heure de Paris). */
export function formatMoment(at: number, now: number): string {
  return sameDay(at, now) ? timeFormatter.format(at) : `le ${formatDayAndTime(at)}`;
}

/** « de 14:05 à 14:12 » le jour même, sinon « du 12 novembre à 23:50 au 13 novembre à 01:50 ». */
export function formatPeriod(start: number, end: number, now: number): string {
  if (sameDay(start, now) && sameDay(end, now)) return `de ${timeFormatter.format(start)} à ${timeFormatter.format(end)}`;
  return `du ${formatDayAndTime(start)} au ${formatDayAndTime(end)}`;
}

export type RenderedAlert = { subject: string; html: string; text: string };

export type OpenAlert = { label: string; kind: 'down' | 'degraded'; since: number };

function subjectFor(down: AlertEvent[], degraded: AlertEvent[], recovered: AlertEvent[]): string {
  const only = (list: AlertEvent[]) => list.length > 0 && list.length === down.length + degraded.length + recovered.length;
  if (only(down)) return down.length === 1 ? `IndieHost : ${down[0]!.label} en panne` : `IndieHost : ${down.length} services en panne`;
  if (only(degraded)) return degraded.length === 1 ? `IndieHost : ${degraded[0]!.label} à surveiller` : `IndieHost : ${degraded.length} services à surveiller`;
  if (only(recovered)) {
    return recovered.length === 1 ? `IndieHost : ${recovered[0]!.label} de nouveau en service` : `IndieHost : ${recovered.length} services de nouveau en service`;
  }
  if (down.length) return `IndieHost : ${down.length === 1 ? `${down[0]!.label} en panne` : `${down.length} services en panne`}, et d’autres changements`;
  return 'IndieHost : état des services';
}

function titleFor(down: AlertEvent[], degraded: AlertEvent[], recovered: AlertEvent[], stillOpen: OpenAlert[]): string {
  if (down.length) return down.length > 1 ? 'Des services d’IndieHost ne répondent plus' : 'Un service d’IndieHost ne répond plus';
  if (degraded.length) return degraded.length > 1 ? 'Des services d’IndieHost sont à surveiller' : 'Un service d’IndieHost est à surveiller';
  const allClear = !stillOpen.length && recovered.every((event) => event.status === 'up');
  if (allClear) return 'Tout est rentré dans l’ordre';
  return recovered.length > 1 ? 'Des services d’IndieHost fonctionnent de nouveau' : 'Un service d’IndieHost fonctionne de nouveau';
}

function problemLines(event: AlertEvent): string {
  if (!event.problems.length) return '';
  return ` ${event.problems.map((problem) => problem.text.replace(/[.\s]+$/, '')).join(' · ')}.`;
}

/** Un seul e-mail pour toutes les alertes d'un passage. `stillOpen` : pannes signalées toujours en cours. */
export function renderHealthAlert(events: AlertEvent[], now: number, stillOpen: OpenAlert[] = []): RenderedAlert {
  const down = events.filter((event) => event.kind === 'down');
  const degraded = events.filter((event) => event.kind === 'degraded');
  const recovered = events.filter((event) => event.kind === 'recovered');
  const subject = subjectFor(down, degraded, recovered);

  const blocks: HostEmailBlock[] = [
    { kind: 'paragraph', text: `Constaté le ${dayFormatter.format(now)} à ${timeFormatter.format(now)} (heure de Paris) par la surveillance du serveur.` },
  ];
  if (down.length) {
    blocks.push({ kind: 'section', title: 'En panne' });
    blocks.push({ kind: 'rows', rows: down.map((event) => ({
      label: event.label,
      value: `${event.summary}${problemLines(event)} Depuis ${formatMoment(event.since, now)}.`,
      strong: true,
    })) });
  }
  if (degraded.length) {
    blocks.push({ kind: 'section', title: 'À surveiller' });
    blocks.push({ kind: 'rows', rows: degraded.map((event) => ({
      label: event.label,
      value: `${event.summary}${problemLines(event)}`,
    })) });
  }
  if (recovered.length) {
    blocks.push({ kind: 'section', title: 'De nouveau en service' });
    blocks.push({ kind: 'rows', rows: recovered.map((event) => {
      const what = event.episodeKind === 'down' ? 'En panne' : 'À surveiller';
      const period = `${what} pendant ${formatOutageDuration(event.statusSince - event.since)}, ${formatPeriod(event.since, event.statusSince, now)}.`;
      return {
        label: event.label,
        value: event.status === 'up' ? period : `N’est plus en panne, mais reste à surveiller : ${event.summary} ${period}`,
      };
    }) });
  }
  if (stillOpen.length && (recovered.length || degraded.length)) {
    blocks.push({ kind: 'section', title: 'Toujours signalé' });
    blocks.push({ kind: 'rows', rows: stillOpen.map((open) => ({
      label: open.label,
      value: `${open.kind === 'down' ? 'En panne' : 'À surveiller'} depuis ${formatMoment(open.since, now)}.`,
    })) });
  }

  const reported = down.length + degraded.length;
  if (reported) {
    blocks.push({
      kind: 'paragraph',
      text: reported > 1
        ? 'Un autre e-mail partira quand ces services fonctionneront de nouveau normalement.'
        : 'Un autre e-mail partira quand ce service fonctionnera de nouveau normalement.',
      muted: true,
    });
  }
  for (const event of [...down, ...degraded].filter((entry) => entry.lastOfDay)) {
    blocks.push({
      kind: 'paragraph',
      text: `${event.label} a déjà été signalé plusieurs fois en 24 h : les prochaines alertes de ce service attendront le lendemain. La page Services reste à jour.`,
      muted: true,
    });
  }
  blocks.push({ kind: 'button', label: 'Voir l’état des services', href: `${resolvePublicBaseUrl()}/dashboard/admin?onglet=services` });

  const rendered = renderHostEmail({
    subject,
    title: titleFor(down, degraded, recovered, stillOpen),
    preheader: subject.replace(/^IndieHost : /, ''),
    blocks,
    legalNote: 'Vous recevez cet e-mail parce que votre adresse reçoit les alertes de l’administration d’IndieHost.',
    audience: 'internal',
  });
  return { subject: rendered.subject, html: rendered.html, text: rendered.text };
}

export type AlertDelivery = { ok: boolean; reason: string | null };

export async function deliverHealthAlert(
  events: AlertEvent[],
  settings: HealthAlertSettings,
  now: number,
  stillOpen: OpenAlert[] = [],
): Promise<AlertDelivery> {
  if (!settings.enabled || !events.length) return { ok: false, reason: 'disabled' };
  const rendered = renderHealthAlert(events, now, stillOpen);
  const result = await sendMail({
    to: settings.recipients,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    tags: ['admin-health-alert'],
    context: { services: events.map((event) => `${event.serviceId}:${event.kind}`) },
  });
  return result.ok ? { ok: true, reason: null } : { ok: false, reason: result.reason };
}
