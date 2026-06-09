-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('INVITED', 'REGISTERED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profession" TEXT,
ADD COLUMN     "monthlyUsage" TEXT,
ADD COLUMN     "dataResidency" TEXT NOT NULL DEFAULT 'eu',
ADD COLUMN     "referralBonusCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transcription" ADD COLUMN     "sttProvider" TEXT;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'INVITED',
    "registeredUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_email_idx" ON "Referral"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referrerId_email_key" ON "Referral"("referrerId", "email");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
