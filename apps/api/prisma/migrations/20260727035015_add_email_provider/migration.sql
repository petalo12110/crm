-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "email_provider" VARCHAR(20) NOT NULL DEFAULT 'smtp',
ADD COLUMN     "resend_api_key_encrypted" TEXT;

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "email_provider" VARCHAR(20) NOT NULL DEFAULT 'smtp',
ADD COLUMN     "resend_api_key_encrypted" TEXT;
