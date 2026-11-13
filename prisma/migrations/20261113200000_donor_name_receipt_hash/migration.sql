-- Name typed for each gift (staff see this, not the shared Donor.name).
ALTER TABLE "Donation" ADD COLUMN "donorName" TEXT;
UPDATE "Donation" AS d SET "donorName" = donor."name" FROM "Donor" AS donor WHERE d."donorId" = donor."id";
ALTER TABLE "Donation" ALTER COLUMN "donorName" SET NOT NULL;

-- Receipt links: store only a hash of the token. Existing values were raw tokens, so drop them.
ALTER TABLE "Donation" RENAME COLUMN "receiptToken" TO "receiptTokenHash";
ALTER TABLE "Donation" ALTER COLUMN "receiptTokenHash" DROP NOT NULL;
UPDATE "Donation" SET "receiptTokenHash" = NULL;
ALTER INDEX "Donation_receiptToken_key" RENAME TO "Donation_receiptTokenHash_key";

-- Per-browser key, so closing "other open payment pages" never touches another person's checkout.
ALTER TABLE "Donation" ADD COLUMN "browserKeyHash" TEXT;
CREATE INDEX "Donation_browserKeyHash_campaignId_idx" ON "Donation"("browserKeyHash", "campaignId");
