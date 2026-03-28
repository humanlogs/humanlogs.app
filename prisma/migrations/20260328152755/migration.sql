/*
  Warnings:

  - You are about to drop the `TranscriptionEncryptionKey` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TranscriptionEncryptionKey" DROP CONSTRAINT "TranscriptionEncryptionKey_transcriptionId_fkey";

-- AlterTable
ALTER TABLE "Transcription" ADD COLUMN     "encryptionKeys" JSONB,
ADD COLUMN     "isTutorial" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "TranscriptionEncryptionKey";
