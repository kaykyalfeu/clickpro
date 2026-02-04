import { readFileSync, readdirSync } from "fs";
import { join } from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const schemaPath = join(__dirname, "..", "prisma", "schema.prisma");
const signupPath = join(__dirname, "..", "src", "app", "api", "auth", "signup", "route.ts");
const migrationsPath = join(__dirname, "..", "prisma", "migrations");

const schema = readFileSync(schemaPath, "utf8");
const signup = readFileSync(signupPath, "utf8");

assert(schema.includes("model Client") && schema.includes("clientId"), "schema.prisma não define clientId no model Client.");
assert(signup.includes("clientId: crypto.randomUUID()"), "signup não está atribuindo clientId no create do Client.");

const migrations = readdirSync(migrationsPath);
const hasHotfix = migrations.some((name) => name.includes("hotfix_add_clientId"));
assert(hasHotfix, "Migration hotfix_add_clientId não encontrada.");

console.log("verify-signup-clientid: OK");
