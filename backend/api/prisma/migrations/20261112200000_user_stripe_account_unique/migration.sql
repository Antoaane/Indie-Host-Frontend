-- Un compte d'encaissement Stripe n'appartient qu'à un profil. Vérifié en production le 2026-11-12
-- avant d'ajouter la contrainte (connectAudit.cli.ts : un seul compte, rattaché à un seul profil).
-- Plusieurs profils sans compte (NULL) restent possibles.
-- CreateIndex
CREATE UNIQUE INDEX "User_stripeConnectAccountId_key" ON "User"("stripeConnectAccountId");
