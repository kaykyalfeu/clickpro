import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureSupabaseCaCertSync } from "../src/lib/ssl-cert";

const originalCwd = process.cwd();
const repoRoot = path.resolve(__dirname, "..", "..");
process.chdir(repoRoot);

const originalSupabaseCert = process.env.SUPABASE_CA_CERT;
const originalPgSslRootCert = process.env.PGSSLROOTCERT;

delete process.env.SUPABASE_CA_CERT;
delete process.env.PGSSLROOTCERT;

const tmpCertPath = path.join(os.tmpdir(), "supabase-ca.crt");

if (fs.existsSync(tmpCertPath)) {
  fs.rmSync(tmpCertPath);
}

const certPath = ensureSupabaseCaCertSync();
assert.ok(certPath, "Expected a certificate path to be resolved.");

const expectedPath = path.resolve(repoRoot, "certs/supabase-prod-ca.crt");
assert.equal(path.resolve(certPath), expectedPath);
assert.equal(path.resolve(process.env.PGSSLROOTCERT ?? ""), expectedPath);

process.chdir(originalCwd);
if (originalSupabaseCert === undefined) {
  delete process.env.SUPABASE_CA_CERT;
} else {
  process.env.SUPABASE_CA_CERT = originalSupabaseCert;
}

if (originalPgSslRootCert === undefined) {
  delete process.env.PGSSLROOTCERT;
} else {
  process.env.PGSSLROOTCERT = originalPgSslRootCert;
}

console.log("SSL certificate fallback assertions passed.");
