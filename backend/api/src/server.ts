import { buildApp } from './app.js';
import { env } from './config/env.js';
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
