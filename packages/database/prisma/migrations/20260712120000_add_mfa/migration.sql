-- Multi-factor auth (TOTP) — auth #2 — 2026-07-12
-- Additive only: three nullable/defaulted columns on `users`, one defaulted
-- column on `organizations`, and one new `mfa_backup_codes` table. Touches no
-- existing auth path — a user with mfaEnabled=false (the default for every
-- existing row) logs in exactly as before. Idempotent (IF NOT EXISTS + guarded
-- FK) so `migrate deploy` is re-runnable, matching the recent migration
-- convention in this tree. No CONCURRENTLY (runs inside the migration txn).

-- AlterTable: users — TOTP enrollment state (mfaSecret is AES-256-GCM ciphertext)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaEnrolledAt" TIMESTAMP(3);

-- AlterTable: organizations — per-org MFA enforcement flag
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "mfaRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: single-use TOTP backup codes (sha256 hashes only)
CREATE TABLE IF NOT EXISTS "mfa_backup_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mfa_backup_codes_userId_idx" ON "mfa_backup_codes"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mfa_backup_codes_codeHash_idx" ON "mfa_backup_codes"("codeHash");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'mfa_backup_codes_userId_fkey'
      AND table_name = 'mfa_backup_codes'
  ) THEN
    ALTER TABLE "mfa_backup_codes"
      ADD CONSTRAINT "mfa_backup_codes_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
