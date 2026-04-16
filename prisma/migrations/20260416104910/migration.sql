-- CreateTable
CREATE TABLE "LandingPageVisit" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingPageVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingPageVisit_visitDate_idx" ON "LandingPageVisit"("visitDate");

-- CreateIndex
CREATE INDEX "LandingPageVisit_ipHash_idx" ON "LandingPageVisit"("ipHash");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPageVisit_ipHash_visitDate_key" ON "LandingPageVisit"("ipHash", "visitDate");
