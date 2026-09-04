-- Credits debited for a transcription at creation, so a job that never produces
-- a transcript can hand them back. Existing rows default to 0: they were charged
-- before this was recorded, so there is no amount to refund for them.
ALTER TABLE "Transcription" ADD COLUMN "creditsCharged" INTEGER NOT NULL DEFAULT 0;
