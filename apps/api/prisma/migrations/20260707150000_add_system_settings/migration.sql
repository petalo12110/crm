-- Platform-wide settings singleton (SMTP config for transactional email)
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id"                  TEXT NOT NULL,
    "smtp_host"           VARCHAR(255),
    "smtp_port"           INTEGER,
    "smtp_secure"         BOOLEAN NOT NULL DEFAULT false,
    "smtp_user"           VARCHAR(255),
    "smtp_pass_encrypted" TEXT,
    "email_from"          VARCHAR(255),
    "updated_at"          TIMESTAMP(3) NOT NULL,
    "updated_by"          TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
