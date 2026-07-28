-- AlterTable
ALTER TABLE "Transcription" ADD COLUMN     "speakers" JSONB;

-- Backfill the documents whose content is readable. An E2E-encrypted transcript
-- cannot be read here (that is the point), so its roster is filled by the first
-- client that holds the key — on the next save, or on opening the document.
UPDATE "Transcription"
SET "speakers" = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', speaker ->> 'id',
      'name', NULLIF(TRIM(COALESCE(speaker ->> 'name', '')), '')
    )
  )
  FROM jsonb_array_elements("transcription" -> 'speakers') AS speaker
  WHERE speaker ->> 'id' IS NOT NULL
)
WHERE jsonb_typeof("transcription" -> 'speakers') = 'array';
