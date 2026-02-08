-- Sync database schema with Prisma schema
-- This migration is idempotent and can safely run on any database state

-- 1. Add clientId to Client table (if not already added by hotfix migration)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Client"
SET "clientId" = md5(random()::text || clock_timestamp()::text)
WHERE "clientId" IS NULL;

ALTER TABLE "Client" ALTER COLUMN "clientId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_clientId_key" ON "Client"("clientId");

-- 2. Make User.passwordHash nullable (required for OAuth users)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- 3. Add OAuth and profile columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubId" TEXT;

-- 4. Add unique indexes for OAuth provider IDs
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_githubId_key" ON "User"("githubId");
