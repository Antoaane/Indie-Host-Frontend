import type { FastifyInstance, FastifyReply } from 'fastify';

import { escapeAttribute, escapeHtml } from './mailLayout.js';
import { verifyUnsubscribeToken } from './hostNotifications.js';

type UnsubscribeQuery = { u?: string; t?: string };

function page(reply: FastifyReply, status: number, title: string, body: string): void {
  reply
    .code(status)
    .header('content-type', 'text/html; charset=utf-8')
    .header('x-robots-tag', 'noindex')
    .header('cache-control', 'no-store')
    .send(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} | IndieHost</title>
</head>
<body style="margin:0;padding:48px 16px;background:#f3f4f6;color:#1b1b1f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<main style="max-width:480px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #e3e5e8;border-radius:12px;">
<p style="margin:0 0 16px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#0063c9;">IndieHost</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
${body}
</main>
</body>
</html>`);
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(text)}</p>`;
}

/**
 * Désinscription des rappels par e-mail aux hôtes (brouillon, paiements à activer, limite de l'offre).
 * Le GET n'enregistre rien (les antivirus de messagerie ouvrent les liens) : il affiche un bouton
 * qui envoie le POST. Le POST accepte aussi le désabonnement en un clic (RFC 8058).
 * Plugin encapsulé (sans fastify-plugin) : le parseur ci-dessous ne s'applique qu'ici. Le corps est
 * ignoré (formulaire, ou multipart pour certaines messageries) : tout est dans l'URL signée.
 */
export async function notificationsPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addContentTypeParser('*', { parseAs: 'string', bodyLimit: 4096 }, (_request, body, done) => {
    done(null, body);
  });

  const readUser = (query: UnsubscribeQuery): string | null => {
    const userId = typeof query.u === 'string' ? query.u.trim() : '';
    const token = typeof query.t === 'string' ? query.t.trim() : '';
    if (!userId || !token || !verifyUnsubscribeToken(userId, token)) return null;
    return userId;
  };

  const invalid = (reply: FastifyReply) =>
    page(reply, 400, 'Lien invalide', paragraph('Ce lien de désinscription est incomplet ou a expiré. Écrivez-nous à contact@indiehost.fr et nous ferons le nécessaire.'));

  fastify.get<{ Querystring: UnsubscribeQuery }>('/notifications/unsubscribe', async (request, reply) => {
    if (!readUser(request.query)) return invalid(reply);

    const action = `?${new URLSearchParams({ u: request.query.u ?? '', t: request.query.t ?? '' })}`;
    return page(reply, 200, 'Ne plus recevoir les rappels', [
      paragraph('Vous ne recevrez plus nos rappels : annonce restée en brouillon, paiements à activer, limite de votre offre.'),
      paragraph('Les e-mails liés à vos réservations, messages et paiements continueront d’arriver.'),
      `<form method="post" action="${escapeAttribute(action)}" style="margin:20px 0 0;">
<button type="submit" style="padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;background:#0063c9;border:0;border-radius:8px;cursor:pointer;">Confirmer</button>
</form>`,
    ].join('\n'));
  });

  fastify.post<{ Querystring: UnsubscribeQuery }>('/notifications/unsubscribe', async (request, reply) => {
    const userId = readUser(request.query);
    if (!userId) return invalid(reply);

    await fastify.prisma.user.updateMany({
      where: { id: userId, emailRemindersOptOutAt: null },
      data: { emailRemindersOptOutAt: new Date() },
    });
    request.log.info({ userId }, '[notifications] rappels par e-mail refusés par l’hôte');

    return page(reply, 200, 'C’est noté', [
      paragraph('Vous ne recevrez plus nos rappels. Les e-mails liés à vos réservations et à vos paiements continueront d’arriver.'),
      paragraph('Vous changez d’avis ? Écrivez-nous à contact@indiehost.fr.'),
    ].join('\n'));
  });
}
