/*
  Warnings:

  - A unique constraint covering the columns `[ipHash,page,visitDate]` on the table `LandingPageVisit` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "LandingPageVisit_ipHash_visitDate_key";

-- AlterTable
ALTER TABLE "LandingPageVisit" ADD COLUMN     "page" TEXT NOT NULL DEFAULT '/';

-- CreateIndex
CREATE INDEX "LandingPageVisit_page_idx" ON "LandingPageVisit"("page");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPageVisit_ipHash_page_visitDate_key" ON "LandingPageVisit"("ipHash", "page", "visitDate");
