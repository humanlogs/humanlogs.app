/*
  Warnings:

  - You are about to drop the column `audioFileEncodedSecret` on the `Transcription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Transcription" DROP COLUMN "audioFileEncodedSecret",
ADD COLUMN     "audioFileEncryption" JSONB;
