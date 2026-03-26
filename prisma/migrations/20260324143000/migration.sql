-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_userId_fkey";

-- DropForeignKey
ALTER TABLE "Transcription" DROP CONSTRAINT "Transcription_userId_fkey";

-- DropIndex
DROP INDEX "Transcription_createdAt_idx";

-- DropIndex
DROP INDEX "Transcription_projectId_idx";

-- DropIndex
DROP INDEX "Transcription_state_idx";

-- DropIndex
DROP INDEX "Transcription_userId_idx";

-- AlterTable
ALTER TABLE "Transcription" ADD COLUMN     "updatedBy" TEXT NOT NULL DEFAULT 'system';

-- CreateTable
CREATE TABLE "TranscriptionHistory" (
    "id" TEXT NOT NULL,
    "transcriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transcription" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "TranscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptionHistory_userId_transcriptionId_updatedAt_idx" ON "TranscriptionHistory"("userId", "transcriptionId", "updatedAt");

-- CreateIndex
CREATE INDEX "Transcription_id_idx" ON "Transcription"("id");

-- CreateIndex
CREATE INDEX "Transcription_userId_id_idx" ON "Transcription"("userId", "id");

-- CreateIndex
CREATE INDEX "Transcription_userId_projectId_idx" ON "Transcription"("userId", "projectId");

-- CreateIndex
CREATE INDEX "Transcription_userId_state_idx" ON "Transcription"("userId", "state");

-- CreateIndex
CREATE INDEX "Transcription_userId_createdAt_idx" ON "Transcription"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcription" ADD CONSTRAINT "Transcription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
