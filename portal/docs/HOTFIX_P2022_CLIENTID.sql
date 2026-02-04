ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Client"
SET "clientId" = md5(random()::text || clock_timestamp()::text)
WHERE "clientId" IS NULL;

ALTER TABLE "Client" ALTER COLUMN "clientId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_clientId_key" ON "Client"("clientId");
