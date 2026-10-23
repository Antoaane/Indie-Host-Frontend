-- Preuve de propriété d'un domaine personnalisé : jeton à publier dans un enregistrement TXT
-- `_indiehost-verification.<domaine>` (valeur `indiehost-verification=<jeton>`) avant la vérification.
-- Les domaines déjà vérifiés restent vérifiés (jeton NULL) ; un nouveau rattachement en génère un.
-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "customDomainVerificationToken" TEXT;
