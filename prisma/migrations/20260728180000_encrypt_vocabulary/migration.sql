-- The custom vocabulary holds participant names, so it is stored like the rest
-- of a document from now on: encrypted for the owner when they have a key.
-- The column becomes JSON to hold either form (a plain array, or an
-- EncryptedDataEntity), the same shape as "speakers".
ALTER TABLE "Transcription"
  ALTER COLUMN "vocabulary" DROP DEFAULT,
  ALTER COLUMN "vocabulary" TYPE JSONB USING to_jsonb("vocabulary"),
  ALTER COLUMN "vocabulary" DROP NOT NULL;

-- Existing rows keep clear text we can no longer encrypt: the key belongs to
-- the user, not to us. For documents that ARE end-to-end encrypted, that clear
-- text is exactly the leak this migration closes, and the value is dead — it is
-- read only when the transcription is created. Drop it there.
UPDATE "Transcription"
SET "vocabulary" = NULL
WHERE "audioFileEncryption" IS NOT NULL;
