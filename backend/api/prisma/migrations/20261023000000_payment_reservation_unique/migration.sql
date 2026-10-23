-- Un paiement ne peut être rattaché qu'à une seule réservation (création de réservation atomique).
-- Doublons éventuels : seul le rattachement le plus récent est conservé ; les autres paiements
-- restent retrouvables par leur PaymentIntent Stripe.
UPDATE "Payment"
SET "reservationId" = NULL
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT "id",
           ROW_NUMBER() OVER (PARTITION BY "reservationId" ORDER BY "createdAt" DESC, "id" DESC) AS "rank"
    FROM "Payment"
    WHERE "reservationId" IS NOT NULL
  ) ranked
  WHERE ranked."rank" > 1
);

-- DropIndex
DROP INDEX "Payment_reservationId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reservationId_key" ON "Payment"("reservationId");
