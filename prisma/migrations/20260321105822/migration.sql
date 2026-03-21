/*
  Warnings:

  - The values [TRANSCRIBING] on the enum `TranscriptionState` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TranscriptionState_new" AS ENUM ('PENDING', 'COMPLETED', 'ERROR');
ALTER TABLE "public"."Transcription" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "Transcription" ALTER COLUMN "state" TYPE "TranscriptionState_new" USING ("state"::text::"TranscriptionState_new");
ALTER TYPE "TranscriptionState" RENAME TO "TranscriptionState_old";
ALTER TYPE "TranscriptionState_new" RENAME TO "TranscriptionState";
DROP TYPE "public"."TranscriptionState_old";
ALTER TABLE "Transcription" ALTER COLUMN "state" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "Transcription" ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';
