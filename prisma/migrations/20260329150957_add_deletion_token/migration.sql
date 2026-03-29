-- CreateTable
CREATE TABLE "DeletionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DeletionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletionToken_token_key" ON "DeletionToken"("token");

-- CreateIndex
CREATE INDEX "DeletionToken_token_idx" ON "DeletionToken"("token");

-- CreateIndex
CREATE INDEX "DeletionToken_userId_idx" ON "DeletionToken"("userId");

-- AddForeignKey
ALTER TABLE "DeletionToken" ADD CONSTRAINT "DeletionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
