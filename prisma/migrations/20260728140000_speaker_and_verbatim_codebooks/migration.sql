-- Codes put on the people of a document are "speaker" codes, whatever the level
-- they sit at (the document itself, or one of its speakers).
ALTER TABLE "Transcription" RENAME COLUMN "participantCodes" TO "speakerCodes";

-- Rewrite the refs written under the previous name.
UPDATE "Transcription"
SET "speakerCodes" = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'speakerId', ref ->> 'participantId',
      'codebookId', ref ->> 'codebookId',
      'codeId', ref ->> 'codeId'
    )
  )
  FROM jsonb_array_elements("speakerCodes") AS ref
)
WHERE jsonb_typeof("speakerCodes") = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements("speakerCodes") AS ref
    WHERE ref ? 'participantId'
  );

-- The five granularities collapse into two: who is in the corpus, and what is
-- said in it.
UPDATE "Codebook" SET "target" = 'speaker'
WHERE "target" IN ('document', 'participant');

UPDATE "Codebook" SET "target" = 'verbatim'
WHERE "target" IN ('sentence', 'subsentence', 'word');

ALTER TABLE "Codebook" ALTER COLUMN "target" SET DEFAULT 'speaker';
