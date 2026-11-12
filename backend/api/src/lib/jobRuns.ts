// Suivi en mémoire des tâches planifiées (dernier passage, durée, erreur, prochain passage), lu par la
// page « Services » de l'administration. Rien n'est écrit en base : un redémarrage de l'API repart
// de zéro, ce qui suffit pour voir si une tâche tourne et si son dernier passage a échoué.

export type JobId = 'retention' | 'host-reminders' | 'public-sites';

export type JobRunState = {
  id: JobId;
  intervalMs: number | null;
  nextRunAt: number | null;
  running: boolean;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastDurationMs: number | null;
  lastStatus: 'ok' | 'error' | null;
  lastError: string | null;
  /** Passage terminé, mais une partie du travail a échoué (ex. un site d'hôte sur cinq). */
  lastWarning: string | null;
  runs: number;
  failures: number;
};

/**
 * Lecture d'un passage terminé sans exception : une tâche qui attrape ses erreurs élément par élément
 * (un site, un e-mail) dit ici si le passage doit compter comme un échec ou comme un simple avertissement.
 */
export type JobRunVerdict = { error?: string | null; warning?: string | null } | null | undefined;

const MAX_ERROR_LENGTH = 300;

const jobs = new Map<JobId, JobRunState>();

function ensureJob(id: JobId): JobRunState {
  let state = jobs.get(id);
  if (!state) {
    state = {
      id,
      intervalMs: null,
      nextRunAt: null,
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastDurationMs: null,
      lastStatus: null,
      lastError: null,
      lastWarning: null,
      runs: 0,
      failures: 0,
    };
    jobs.set(id, state);
  }
  return state;
}

function trimMessage(message: string): string {
  const trimmed = message.trim() || 'Erreur inconnue.';
  return trimmed.length > MAX_ERROR_LENGTH ? `${trimmed.slice(0, MAX_ERROR_LENGTH - 1)}…` : trimmed;
}

function readErrorMessage(error: unknown): string {
  return trimMessage(error instanceof Error ? error.message : String(error ?? ''));
}

/** Déclare une tâche planifiée et l'heure de son premier passage. */
export function registerScheduledJob(id: JobId, options: { intervalMs: number; firstRunAt: number }): void {
  const state = ensureJob(id);
  state.intervalMs = options.intervalMs;
  state.nextRunAt = options.firstRunAt;
}

/**
 * Exécute un passage en notant son début, sa fin et son éventuelle erreur (relancée telle quelle).
 * `assess` juge un passage terminé sans exception : échec (compté comme tel) ou avertissement.
 */
export async function trackJobRun<T>(id: JobId, run: () => Promise<T>, assess?: (result: T) => JobRunVerdict): Promise<T> {
  const state = ensureJob(id);
  const startedAt = Date.now();
  state.running = true;
  state.lastStartedAt = startedAt;

  try {
    const result = await run();
    const verdict = assess?.(result) ?? null;
    if (verdict?.error) {
      state.lastStatus = 'error';
      state.lastError = trimMessage(verdict.error);
      state.lastWarning = null;
      state.failures += 1;
    } else {
      state.lastStatus = 'ok';
      state.lastError = null;
      state.lastWarning = verdict?.warning ? trimMessage(verdict.warning) : null;
    }
    return result;
  } catch (error) {
    state.lastStatus = 'error';
    state.lastError = readErrorMessage(error);
    state.lastWarning = null;
    state.failures += 1;
    throw error;
  } finally {
    const finishedAt = Date.now();
    state.running = false;
    state.lastFinishedAt = finishedAt;
    state.lastDurationMs = finishedAt - startedAt;
    state.runs += 1;
    if (state.intervalMs) state.nextRunAt = startedAt + state.intervalMs;
  }
}

export function listJobRuns(): JobRunState[] {
  return [...jobs.values()].map((state) => ({ ...state }));
}
