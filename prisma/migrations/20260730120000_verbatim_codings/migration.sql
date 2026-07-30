-- Verbatim coding: one row per (passage, code, author). The passage is anchored in
-- the transcript by a `coding` mark carrying this id, the same way comment threads
-- are — so the range moves with the text and is versioned with the document, while
-- the code ids stay opaque uuids the server can store without reading.
CREATE TABLE "Coding" (
    "id" TEXT NOT NULL,
    "transcriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codebookId" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Coding_transcriptionId_idx" ON "Coding"("transcriptionId");

-- "My codes only" is the default reading of a coded document, so filtering by author
-- inside one transcription is the hot path.
CREATE INDEX "Coding_transcriptionId_userId_idx" ON "Coding"("transcriptionId", "userId");

ALTER TABLE "Coding" ADD CONSTRAINT "Coding_transcriptionId_fkey" FOREIGN KEY ("transcriptionId") REFERENCES "Transcription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Coding" ADD CONSTRAINT "Coding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
