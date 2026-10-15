-- "How much of this interview is coded" needs two lengths, and only the CLIENT can
-- supply either: the transcript may be end-to-end encrypted, so the server holds a
-- coding without ever knowing what it spans. Both are snapshots taken at write time
-- and never maintained — a passage is an anchor and moves with the text — which is
-- fine for a ratio nobody checks character by character. Overlapping codings double
-- count, so the ratio is clamped to [0, 100] where it is shown.
ALTER TABLE "Coding" ADD COLUMN "textLength" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Transcription" ADD COLUMN "textLength" INTEGER;
