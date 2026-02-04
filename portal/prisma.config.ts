import "dotenv/config";
import { defineConfig } from "prisma/config";

// Use process.env directly to avoid PrismaConfigEnvError when DATABASE_URL is missing
// during prisma generate in CI/local environments
const databaseUrl = process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl },
});
