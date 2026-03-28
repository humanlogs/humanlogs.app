/*
  Warnings:

  - You are about to drop the column `encryptionKeys` on the `Transcription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Transcription" DROP COLUMN "encryptionKeys",
ADD COLUMN     "encryption" JSONB;
