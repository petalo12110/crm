-- Add notification preferences to company_members
ALTER TABLE "company_members" ADD COLUMN IF NOT EXISTS "notification_prefs" JSONB;
