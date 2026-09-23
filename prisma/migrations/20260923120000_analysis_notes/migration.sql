-- A written analysis of one SLICE of a study: not of a passage, but of the
-- combination of facets the excerpt table was showing — the group, plus the
-- filters. `key` is the canonical (sorted, deduplicated) form of that set, so the
-- same question asked in a different order finds the note already written; and a
-- wider view finds the narrower notes, because their sets are supersets of its own.
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "facets" JSONB NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- The whole table for one study is read at once: the narrower-note lookup is a
-- containment test over facet sets, which no index can serve, and a study holds
-- tens to hundreds of notes rather than thousands.
CREATE INDEX "Analysis_projectId_idx" ON "Analysis"("projectId");

-- One note per author per slice. Per author like a coding: two researchers reading
-- the same slice write two analyses and neither overwrites the other.
CREATE UNIQUE INDEX "Analysis_projectId_userId_key_key" ON "Analysis"("projectId", "userId", "key");

ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
