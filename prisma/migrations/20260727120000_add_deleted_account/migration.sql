-- CreateTable
CREATE TABLE "DeletedAccount" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "deletionCount" INTEGER NOT NULL DEFAULT 1,
    "firstDeletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDeletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletedAccount_emailHash_key" ON "DeletedAccount"("emailHash");

-- CreateIndex
CREATE INDEX "DeletedAccount_lastDeletedAt_idx" ON "DeletedAccount"("lastDeletedAt");
