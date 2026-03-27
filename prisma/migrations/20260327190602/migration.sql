-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('RATING', 'FEATURE_REQUEST');

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "type" "FeedbackType" NOT NULL DEFAULT 'RATING',
ALTER COLUMN "rating" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Feedback_type_idx" ON "Feedback"("type");
