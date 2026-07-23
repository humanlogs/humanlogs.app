-- Add visual customization to studies (projects): icon / emoji / image + color.
-- Idempotent so it can run harmlessly even if the columns already exist.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "iconType" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "imageKey" TEXT;
