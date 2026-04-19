-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastMarketingEmailAt" TIMESTAMP(3),
ADD COLUMN     "marketingEmailStep" INTEGER NOT NULL DEFAULT 0;

-- Set existing users to step 99 (completed) so they don't receive marketing emails
UPDATE "User" SET "marketingEmailStep" = 99 WHERE "createdAt" < NOW();
