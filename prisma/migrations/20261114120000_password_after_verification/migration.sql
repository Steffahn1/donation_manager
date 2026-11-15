-- Donor passwords are set when the email is confirmed, so unconfirmed signups have none yet.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
