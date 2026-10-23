-- Compte clos (suppression RGPD) : la ligne User est anonymisée, jamais supprimée (pièces comptables 10 ans).
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);
