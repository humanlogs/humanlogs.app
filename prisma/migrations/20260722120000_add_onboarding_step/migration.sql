-- AlterTable
-- Records the furthest onboarding step a user reached so we can measure drop-off.
-- Existing users are backfilled to "done" when they already completed onboarding.
ALTER TABLE "User" ADD COLUMN "onboardingStep" TEXT NOT NULL DEFAULT 'profile';

UPDATE "User" SET "onboardingStep" = 'done' WHERE "isWelcomeDone" = true;
