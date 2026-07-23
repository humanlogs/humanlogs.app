-- Add mediaType to distinguish audio-transcribed vs imported-text transcriptions
ALTER TABLE "Transcription" ADD COLUMN IF NOT EXISTS "mediaType" TEXT NOT NULL DEFAULT 'audio';
