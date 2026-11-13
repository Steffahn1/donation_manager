-- AlterTable
ALTER TABLE "Donation" ADD COLUMN "checkoutAttemptId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Donation_checkoutAttemptId_key" ON "Donation"("checkoutAttemptId");
