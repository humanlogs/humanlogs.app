-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "transcriptionId" TEXT NOT NULL,
    "anchorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentHistory" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_transcriptionId_idx" ON "Comment"("transcriptionId");

-- CreateIndex
CREATE INDEX "Comment_transcriptionId_anchorId_idx" ON "Comment"("transcriptionId", "anchorId");

-- CreateIndex
CREATE INDEX "CommentHistory_commentId_createdAt_idx" ON "CommentHistory"("commentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_transcriptionId_fkey" FOREIGN KEY ("transcriptionId") REFERENCES "Transcription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentHistory" ADD CONSTRAINT "CommentHistory_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
