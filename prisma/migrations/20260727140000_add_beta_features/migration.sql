-- AlterTable
-- Opt-in flag for features that are still in beta (currently: codebooks).
-- Everyone starts opted out; the toggle lives in /app/account.
ALTER TABLE "User" ADD COLUMN "betaFeatures" BOOLEAN NOT NULL DEFAULT false;
