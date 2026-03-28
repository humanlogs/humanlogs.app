/*
  Warnings:

  - You are about to drop the column `audioFileEncrypted` on the `Transcription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Transcription" DROP COLUMN "audioFileEncrypted",
ADD COLUMN     "audioFileEncodedSecret" TEXT NOT NULL DEFAULT '';
