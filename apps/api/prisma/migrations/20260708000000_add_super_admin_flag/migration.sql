-- Super admins become a platform-level flag on the user, independent of
-- any company membership.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- Migrate any existing SUPER_ADMIN company memberships onto the new flag,
-- then drop those membership rows — a super admin should not be tied to
-- any specific company anymore.
UPDATE "users" u
SET "is_super_admin" = true
FROM "company_members" cm
WHERE cm."user_id" = u."id" AND cm."role" = 'SUPER_ADMIN';

DELETE FROM "company_members" WHERE "role" = 'SUPER_ADMIN';
