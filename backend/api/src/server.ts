import { buildApp } from './app.js';
import { env } from './config/env.js';
import { startHostRemindersScheduler } from './jobs/hostReminders.js';
import { startPublicSitesScheduler } from './jobs/publicSites.js';
import { startRetentionScheduler } from './jobs/retention.js';

async function start() {
  const app = await buildApp();

  // Purge automatique des données (durées de la politique de confidentialité) : jamais en test,
  // désactivable par RETENTION_PURGE_ENABLED=false. Déclarée avant `listen` (hooks figés au boot).
  if (env.NODE_ENV !== 'test') {
    if (env.RETENTION_PURGE_ENABLED) {
      const stopRetentionScheduler = startRetentionScheduler(app.prisma, app.log);
      app.addHook('onClose', async () => {
        stopRetentionScheduler();
      });
    } else {
      app.log.warn('Retention purge disabled (RETENTION_PURGE_ENABLED=false): run `npm run purge` manually.');
    }

    // Rappels par e-mail aux hôtes (arrivée demain, brouillon, paiements, fin d'essai…) : sans effet
    // tant qu'aucun service d'envoi n'est configuré ; HOST_REMINDERS_ENABLED=false pour les couper.
    if (env.HOST_REMINDERS_ENABLED) {
      const stopHostReminders = startHostRemindersScheduler(app.prisma, app.log);
      app.addHook('onClose', async () => {
        stopHostReminders();
      });
    }

    // Référencement des sites d'hôtes : pré-remplissage des pages principales, certificats `www`,
    // Search Console (avec une clé Google) et IndexNow ; PUBLIC_SITES_JOB_ENABLED=false pour le couper.
    if (env.PUBLIC_SITES_JOB_ENABLED) {
      const stopPublicSites = startPublicSitesScheduler(app.prisma, app.log);
      app.addHook('onClose', async () => {
        stopPublicSites();
      });
    }
  }

  // Arrêt demandé (redéploiement : Docker envoie SIGTERM, que `npm` transmet à node ; Ctrl+C en local) :
  // fermeture propre, qui lance les hooks `onClose` (dernières mesures de santé écrites en base,
  // planificateurs arrêtés, connexions à la base fermées). Docker coupe au bout de 10 s : on n'en prend
  // que 8 au plus.
  let closing = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      if (closing) return;
      closing = true;
      app.log.info({ signal }, 'Shutdown requested: closing the API');
      const forced = setTimeout(() => process.exit(0), 8000);
      forced.unref();
      app.close().then(
        () => process.exit(0),
        (error: unknown) => {
          app.log.error({ err: error }, 'Shutdown failed');
          process.exit(1);
        },
      );
    });
  }

  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
