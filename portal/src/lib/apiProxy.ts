// ---------------------------------------------------------------------------
// apiProxy.ts — Production-ready reverse proxy for ClickPro upstream API
// ---------------------------------------------------------------------------

const PROXY_TIMEOUT_MS = 10_000;

/** Hostnames and IP patterns that must never be used as upstream targets. */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^\[::1?\]$/,
];

// ---------------------------------------------------------------------------
// Error codes — structured, traceable, never masked
// ---------------------------------------------------------------------------
const ErrorCode = {
  UPSTREAM_NOT_CONFIGURED: "UPSTREAM_NOT_CONFIGURED",
  UPSTREAM_INVALID_URL: "UPSTREAM_INVALID_URL",
  UPSTREAM_BLOCKED_HOST: "UPSTREAM_BLOCKED_HOST",
  UPSTREAM_POINTS_TO_SELF: "UPSTREAM_POINTS_TO_SELF",
  UPSTREAM_TIMEOUT: "UPSTREAM_TIMEOUT",
  UPSTREAM_UNREACHABLE: "UPSTREAM_UNREACHABLE",
  MISSING_CLIENT_ID: "MISSING_CLIENT_ID",
  MISSING_AUTHORIZATION: "MISSING_AUTHORIZATION",
  INTERNAL_PROXY_ERROR: "INTERNAL_PROXY_ERROR",
} as const;

type ProxyErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `req_${ts}_${rand}`;
}

function isBlockedHost(hostname: string): boolean {
  const clean = hostname.replace(/:\d+$/, "");
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(clean));
}

/**
 * Normalise the raw CLICKPRO_API_URL env-var value:
 *  1. trim whitespace
 *  2. strip surrounding quotes (common copy-paste from Vercel dashboard)
 *  3. ensure https:// protocol if no protocol present
 *  4. remove trailing slash
 */
function normaliseUrl(raw: string): string {
  let url = raw.trim();
  // Strip surrounding single or double quotes
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }
  // Ensure protocol
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Remove trailing slash
  url = url.replace(/\/+$/, "");
  return url;
}

/**
 * Read, normalise, and validate CLICKPRO_API_URL.
 * Returns { url: URL } on success, or { error, code } on failure.
 */
function resolveUpstreamBase(): { url: URL; error?: never; code?: never } | { url?: never; error: string; code: ProxyErrorCode } {
  const raw = process.env.CLICKPRO_API_URL ?? "";
  if (!raw.trim()) {
    return {
      error: "CLICKPRO_API_URL is not set or empty.",
      code: ErrorCode.UPSTREAM_NOT_CONFIGURED,
    };
  }

  const normalised = normaliseUrl(raw);

  try {
    const parsed = new URL(normalised);
    // Only allow http(s) protocols
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        error: `CLICKPRO_API_URL has unsupported protocol: ${parsed.protocol}`,
        code: ErrorCode.UPSTREAM_INVALID_URL,
      };
    }
    return { url: parsed };
  } catch {
    return {
      error: "CLICKPRO_API_URL is not a valid URL after normalisation.",
      code: ErrorCode.UPSTREAM_INVALID_URL,
    };
  }
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("ehostunreach") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("socket hang up")
  );
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

function makeErrorResponse(
  status: number,
  code: ProxyErrorCode,
  message: string,
  details: string,
  requestId: string,
  durationMs?: number,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-proxy-error-type": code,
    "x-request-id": requestId,
  };
  if (durationMs !== undefined) {
    headers["x-proxy-response-time"] = `${durationMs}ms`;
  }
  return new Response(
    JSON.stringify({ error: message, code, details }),
    { status, headers },
  );
}

// ---------------------------------------------------------------------------
// Main proxy function
// ---------------------------------------------------------------------------

export async function proxyToClickproApi(request: Request, pathSegments: string[]) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const elapsed = () => Date.now() - startTime;

  try {
    // --- 1. Validate clientId in path ---
    const clientId = pathSegments.length > 0 ? pathSegments[0].trim() : null;
    if (!clientId) {
      console.error(`[apiProxy] [${requestId}] Missing client ID in path`);
      return makeErrorResponse(
        400,
        ErrorCode.MISSING_CLIENT_ID,
        "Client ID is required",
        "The path must include a client ID: /api/clients/{id}/...",
        requestId,
        elapsed(),
      );
    }

    // --- 2. Validate Authorization header ---
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error(`[apiProxy] [${requestId}] Missing or invalid Authorization header`);
      return makeErrorResponse(
        401,
        ErrorCode.MISSING_AUTHORIZATION,
        "Autorização necessária",
        "Ative sua licença para obter um token JWT válido antes de salvar credenciais.",
        requestId,
        elapsed(),
      );
    }

    // --- 3. Resolve and validate upstream URL ---
    const upstreamResult = resolveUpstreamBase();
    if (upstreamResult.error) {
      console.error(`[apiProxy] [${requestId}] ${upstreamResult.code}: ${upstreamResult.error}`, {
        has_env: Boolean(process.env.CLICKPRO_API_URL),
        raw_length: (process.env.CLICKPRO_API_URL ?? "").length,
      });
      return makeErrorResponse(
        503,
        upstreamResult.code,
        upstreamResult.error,
        "Configure a variável CLICKPRO_API_URL nas configurações do Vercel (Project Settings > Environment Variables) com a URL pública do backend.",
        requestId,
        elapsed(),
      );
    }

    const upstreamBase = upstreamResult.url!;

    // Build full upstream path
    const requestUrl = new URL(request.url);
    const basePath = upstreamBase.pathname.replace(/\/$/, "");
    const targetPath = ["api", "clients", ...pathSegments].join("/");
    const upstreamUrl = new URL(upstreamBase.origin);
    upstreamUrl.pathname = `${basePath}/${targetPath}`.replace(/\/+/g, "/");
    upstreamUrl.search = requestUrl.search;

    // --- 4. Block private/localhost upstream targets ---
    if (isBlockedHost(upstreamUrl.hostname)) {
      console.error(`[apiProxy] [${requestId}] UPSTREAM_BLOCKED_HOST: ${upstreamUrl.hostname}`);
      return makeErrorResponse(
        503,
        ErrorCode.UPSTREAM_BLOCKED_HOST,
        "CLICKPRO_API_URL aponta para um endereço privado/localhost",
        "Configure CLICKPRO_API_URL com a URL pública do backend (ex: https://api.clickpro.com).",
        requestId,
        elapsed(),
      );
    }

    // --- 5. Detect self-referencing loop ---
    const requestHost = request.headers.get("host") || "";
    const forwardedHost = request.headers.get("x-forwarded-host") || "";
    const upstreamHost = upstreamUrl.host;
    const upstreamHostname = upstreamUrl.hostname;

    // Compare by both host (with port) and hostname (without port)
    const selfHosts = [requestHost, forwardedHost].filter(Boolean);
    const isSelfLoop = selfHosts.some((h) => {
      const hostWithoutPort = h.replace(/:\d+$/, "");
      return upstreamHost === h || upstreamHostname === hostWithoutPort;
    });

    if (isSelfLoop) {
      console.error(`[apiProxy] [${requestId}] UPSTREAM_POINTS_TO_SELF: upstream=${upstreamHost} requestHost=${requestHost} forwardedHost=${forwardedHost}`);
      return makeErrorResponse(
        503,
        ErrorCode.UPSTREAM_POINTS_TO_SELF,
        "Loop detectado: CLICKPRO_API_URL aponta para esta mesma aplicação",
        "Configure CLICKPRO_API_URL para apontar para o servidor da API WhatsApp Integration (ex: https://api.clickpro.com), não para este portal.",
        requestId,
        elapsed(),
      );
    }

    // --- 6. Prepare and forward request ---
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    headers.set("x-forwarded-host", requestHost || "unknown");
    headers.set("x-request-id", requestId);

    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer();

    // AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    console.log(`[apiProxy] [${requestId}] ${request.method} -> ${upstreamUrl.hostname}${upstreamUrl.pathname}`);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const duration = elapsed();

    console.log(`[apiProxy] [${requestId}] upstream=${upstreamUrl.hostname} status=${upstreamResponse.status} duration=${duration}ms`);

    // --- 7. Handle upstream errors ---
    if (!upstreamResponse.ok) {
      const responseText = await upstreamResponse.text();
      console.error(`[apiProxy] [${requestId}] Upstream error: status=${upstreamResponse.status} body=${responseText.slice(0, 500)}`);

      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: "Upstream error", details: responseText.slice(0, 500) };
      }

      const responseHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "x-proxy-upstream-host": upstreamUrl.hostname,
        "x-proxy-response-time": `${duration}ms`,
        "x-request-id": requestId,
      };

      return new Response(
        JSON.stringify({
          error: `Upstream API returned ${upstreamResponse.status}`,
          code: `UPSTREAM_${upstreamResponse.status}`,
          details: errorData,
          upstreamStatus: upstreamResponse.status,
        }),
        {
          status: upstreamResponse.status,
          headers: responseHeaders,
        },
      );
    }

    // --- 8. Forward successful response with instrumentation headers ---
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");
    responseHeaders.set("x-proxy-upstream-host", upstreamUrl.hostname);
    responseHeaders.set("x-proxy-response-time", `${duration}ms`);
    responseHeaders.set("x-request-id", requestId);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const duration = elapsed();

    // Timeout
    if (isAbortError(error)) {
      console.error(`[apiProxy] [${requestId}] UPSTREAM_TIMEOUT after ${duration}ms`);
      return makeErrorResponse(
        504,
        ErrorCode.UPSTREAM_TIMEOUT,
        "Upstream timeout",
        `O backend não respondeu em ${PROXY_TIMEOUT_MS / 1000}s. Verifique se o servidor está acessível e respondendo normalmente.`,
        requestId,
        duration,
      );
    }

    // Network errors (ECONNREFUSED, ENOTFOUND, etc.)
    if (isNetworkError(error)) {
      console.error(`[apiProxy] [${requestId}] UPSTREAM_UNREACHABLE: ${error instanceof Error ? error.message : error}`);
      return makeErrorResponse(
        503,
        ErrorCode.UPSTREAM_UNREACHABLE,
        "Não foi possível conectar ao backend",
        "Verifique se o servidor está rodando e acessível. Confirme que CLICKPRO_API_URL está correto nas configurações do Vercel.",
        requestId,
        duration,
      );
    }

    // Unknown error
    console.error(`[apiProxy] [${requestId}] INTERNAL_PROXY_ERROR:`, error);
    return makeErrorResponse(
      500,
      ErrorCode.INTERNAL_PROXY_ERROR,
      "Internal proxy error",
      error instanceof Error ? error.message : String(error),
      requestId,
      duration,
    );
  }
}
