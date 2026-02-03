ALTER TABLE "Client" ADD COLUMN "clientId" TEXT;

UPDATE "Client"
SET "clientId" = md5(random()::text || clock_timestamp()::text)
WHERE "clientId" IS NULL;

ALTER TABLE "Client" ALTER COLUMN "clientId" SET NOT NULL;

CREATE UNIQUE INDEX "Client_clientId_key" ON "Client"("clientId");
