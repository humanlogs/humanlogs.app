-- CreateTable
CREATE TABLE "TranscriptionEncryptionKey" (
    "id" TEXT NOT NULL,
    "transcriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedEncryptionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptionEncryptionKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptionEncryptionKey_transcriptionId_idx" ON "TranscriptionEncryptionKey"("transcriptionId");

-- CreateIndex
CREATE INDEX "TranscriptionEncryptionKey_userId_idx" ON "TranscriptionEncryptionKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptionEncryptionKey_transcriptionId_userId_key" ON "TranscriptionEncryptionKey"("transcriptionId", "userId");

-- AddForeignKey
ALTER TABLE "TranscriptionEncryptionKey" ADD CONSTRAINT "TranscriptionEncryptionKey_transcriptionId_fkey" FOREIGN KEY ("transcriptionId") REFERENCES "Transcription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
