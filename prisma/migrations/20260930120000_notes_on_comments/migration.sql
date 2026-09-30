-- Analyses become comments.
--
-- A comment and an analysis were the same act at two scales: a researcher saying
-- what they make of something. The first was anchored to a passage by a mark id,
-- the second to a SLICE of the corpus by a facet key — which is a difference in
-- what the anchor names, not in what the row is. So there is one table now, and
-- `anchorType` says which kind of key `anchorId` holds (see lib/comments/anchor.ts).
--
-- Two things come free with the merge. A slice note is now end-to-end encrypted
-- like every other note, where the `Analysis` table stored it in clear. And a
-- slice note is a THREAD: colleagues can answer one, which is what a comment
-- already was and what an analysis could not be.

-- A slice note is about a study, not about any one interview.
ALTER TABLE "Comment" ALTER COLUMN "transcriptionId" DROP NOT NULL;
ALTER TABLE "Comment" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Comment" ADD COLUMN "anchorType" TEXT NOT NULL DEFAULT 'passage';
ALTER TABLE "Comment" ADD COLUMN "facets" JSONB;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The slice notes of a study are read as a set, and the narrower-note question is
-- a containment test over facet sets that no index can serve — so this only has to
-- get the study's rows out, and the reader intersects.
CREATE INDEX "Comment_projectId_anchorType_idx" ON "Comment"("projectId", "anchorType");

-- The separate table it replaces. Nothing is in production; the notes written
-- while it existed are not worth a migration path neither of us would ever read.
DROP TABLE IF EXISTS "Analysis";
