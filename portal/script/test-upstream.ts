#!/usr/bin/env npx tsx
// ---------------------------------------------------------------------------
// test-upstream.ts — Verifies proxy health, upstream connectivity, and
//                    detects self-referencing loops.
//
// Usage:
//   npx tsx script/test-upstream.ts https://clickpro.grupogarciaseguradoras.com.br
//   npx tsx script/test-upstream.ts http://localhost:3000
// ---------------------------------------------------------------------------

const BASE = process.argv[2];
if (!BASE) {
  console.error("Usage: npx tsx script/test-upstream.ts <BASE_URL>");
  console.error("Example: npx tsx script/test-upstream.ts https://clickpro.grupogarciaseguradoras.com.br");
  process.exit(1);
}

const TIMEOUT_MS = 15_000;

interface TestResult {
  name: string;
  url: string;
  status: number | "ERROR";
  ok: boolean;
  duration: number;
  body?: unknown;
  error?: string;
  headers?: Record<string, string>;
}

async function testEndpoint(name: string, url: string, init?: RequestInit): Promise<TestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const duration = Date.now() - start;

    let body: unknown;
    const ct = response.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    const proxyHeaders: Record<string, string> = {};
    for (const key of ["x-proxy-upstream-host", "x-proxy-error-type", "x-proxy-response-time", "x-request-id"]) {
      const val = response.headers.get(key);
      if (val) proxyHeaders[key] = val;
    }

    return {
      name,
      url,
      status: response.status,
      ok: response.ok,
      duration,
      body,
      headers: Object.keys(proxyHeaders).length > 0 ? proxyHeaders : undefined,
    };
  } catch (err) {
    clearTimeout(timer);
    const duration = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof DOMException && err.name === "AbortError";
    return {
      name,
      url,
      status: "ERROR",
      ok: false,
      duration,
      error: isTimeout ? `Timeout after ${TIMEOUT_MS}ms` : message,
    };
  }
}

function printResult(result: TestResult) {
  const icon = result.ok ? "\x1b[32m PASS \x1b[0m" : "\x1b[31m FAIL \x1b[0m";
  console.log(`\n[${icon}] ${result.name}`);
  console.log(`  URL:      ${result.url}`);
  console.log(`  Status:   ${result.status}`);
  console.log(`  Duration: ${result.duration}ms`);
  if (result.headers) {
    console.log("  Proxy Headers:");
    for (const [k, v] of Object.entries(result.headers)) {
      console.log(`    ${k}: ${v}`);
    }
  }
  if (result.error) {
    console.log(`  Error:    ${result.error}`);
  }
  if (result.body && typeof result.body === "object") {
    console.log(`  Body:     ${JSON.stringify(result.body, null, 2).split("\n").join("\n            ")}`);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("ClickPro Upstream Connectivity Test");
  console.log(`Target: ${BASE}`);
  console.log(`Time:   ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  const results: TestResult[] = [];

  // --- Test 1: /health (portal health) ---
  results.push(await testEndpoint("Portal Health (/health)", `${BASE}/health`));

  // --- Test 2: /api/health/db (database health) ---
  results.push(await testEndpoint("Database Health (/api/health/db)", `${BASE}/api/health/db`));

  // --- Test 3: Proxy without auth (should get 401) ---
  results.push(
    await testEndpoint(
      "Proxy without auth (expect 401)",
      `${BASE}/api/clients/test-client-id/credentials/status`,
    ),
  );

  // --- Test 4: Proxy with dummy auth (should get upstream error, not 503 loop) ---
  results.push(
    await testEndpoint(
      "Proxy with dummy auth (expect upstream error, not self-loop 503)",
      `${BASE}/api/clients/test-client-id/credentials/status`,
      {
        headers: {
          Authorization: "Bearer test-token-for-connectivity-check",
        },
      },
    ),
  );

  // --- Test 5: Rapid consecutive calls to detect loop amplification ---
  console.log("\n--- Loop detection: 3 rapid calls ---");
  const rapidResults: TestResult[] = [];
  for (let i = 0; i < 3; i++) {
    rapidResults.push(
      await testEndpoint(
        `Rapid call #${i + 1}`,
        `${BASE}/api/clients/test-client-id/templates`,
        {
          headers: {
            Authorization: "Bearer test-token-for-loop-check",
          },
        },
      ),
    );
  }
  results.push(...rapidResults);

  // Check for loop amplification: all calls should return similar status
  const rapidStatuses = rapidResults.map((r) => r.status);
  const allSame = rapidStatuses.every((s) => s === rapidStatuses[0]);
  if (allSame) {
    console.log(`\n  [OK] All rapid calls returned same status (${rapidStatuses[0]}), no loop amplification.`);
  } else {
    console.log(`\n  [WARN] Rapid calls returned different statuses: ${rapidStatuses.join(", ")} — possible instability.`);
  }

  // --- Summary ---
  console.log("\n" + "=".repeat(60));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(60));

  for (const result of results) {
    printResult(result);
  }

  const passed = results.filter((r) => r.name.includes("Health") && r.ok).length;
  const healthTests = results.filter((r) => r.name.includes("Health")).length;
  const proxy401 = results.find((r) => r.name.includes("without auth"));
  const proxyUpstream = results.find((r) => r.name.includes("dummy auth"));

  console.log("\n" + "=".repeat(60));
  console.log("DIAGNOSIS");
  console.log("=".repeat(60));
  console.log(`  Health endpoints: ${passed}/${healthTests} passing`);

  if (proxy401?.status === 401) {
    console.log("  Auth validation: Working (401 on missing auth)");
  } else {
    console.log(`  Auth validation: UNEXPECTED (got ${proxy401?.status} instead of 401)`);
  }

  if (proxyUpstream) {
    const errorType = proxyUpstream.headers?.["x-proxy-error-type"];
    if (errorType === "UPSTREAM_POINTS_TO_SELF") {
      console.log("  \x1b[31mSELF-LOOP DETECTED: CLICKPRO_API_URL points to the portal itself!\x1b[0m");
      console.log("  Fix: Set CLICKPRO_API_URL to the external API URL in Vercel env vars.");
    } else if (errorType === "UPSTREAM_NOT_CONFIGURED" || errorType === "UPSTREAM_INVALID_URL") {
      console.log(`  \x1b[33mUpstream issue: ${errorType}\x1b[0m`);
      console.log("  Fix: Set CLICKPRO_API_URL correctly in Vercel env vars.");
    } else if (errorType === "UPSTREAM_UNREACHABLE" || errorType === "UPSTREAM_TIMEOUT") {
      console.log(`  \x1b[33mUpstream connectivity: ${errorType}\x1b[0m`);
      console.log("  Fix: Verify the backend server is running and reachable.");
    } else if (proxyUpstream.ok || (proxyUpstream.status !== "ERROR" && proxyUpstream.status < 500)) {
      console.log("  Proxy forwarding: Working (upstream responded)");
    } else {
      console.log(`  Proxy status: ${proxyUpstream.status} ${proxyUpstream.error ?? ""}`);
    }
  }

  console.log("=".repeat(60));

  const hasCriticalFailure = !results.find((r) => r.name === "Portal Health (/health)")?.ok;
  process.exit(hasCriticalFailure ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
