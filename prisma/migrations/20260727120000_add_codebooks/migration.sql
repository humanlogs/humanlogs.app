-- AlterTable
ALTER TABLE "Transcription" ADD COLUMN     "codes" JSONB;

-- CreateTable
CREATE TABLE "Codebook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "allStudies" BOOLEAN NOT NULL DEFAULT false,
    "target" TEXT NOT NULL DEFAULT 'document',
    "preset" TEXT,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Codebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodebookStudy" (
    "codebookId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "CodebookStudy_pkey" PRIMARY KEY ("codebookId","projectId")
);

-- CreateIndex
CREATE INDEX "Codebook_userId_idx" ON "Codebook"("userId");

-- CreateIndex
CREATE INDEX "Codebook_parentId_idx" ON "Codebook"("parentId");

-- CreateIndex
CREATE INDEX "CodebookStudy_projectId_idx" ON "CodebookStudy"("projectId");

-- AddForeignKey
ALTER TABLE "Codebook" ADD CONSTRAINT "Codebook_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Codebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Codebook" ADD CONSTRAINT "Codebook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodebookStudy" ADD CONSTRAINT "CodebookStudy_codebookId_fkey" FOREIGN KEY ("codebookId") REFERENCES "Codebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodebookStudy" ADD CONSTRAINT "CodebookStudy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

