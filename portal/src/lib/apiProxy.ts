const DEFAULT_UPSTREAM_URL = "";

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

function isBlockedHost(hostname: string): boolean {
  const clean = hostname.replace(/:\d+$/, ""); // strip port
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(clean));
}

function getUpstreamBaseUrl() {
  return process.env.CLICKPRO_API_URL || DEFAULT_UPSTREAM_URL;
}

function buildUpstreamUrl(request: Request, pathSegments: string[]) {
  const baseUrl = getUpstreamBaseUrl();
  if (!baseUrl) {
    return null;
  }
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(baseUrl);
  const basePath = upstreamUrl.pathname.replace(/\/$/, "");
  const targetPath = ["api", "clients", ...pathSegments].join("/");
  upstreamUrl.pathname = `${basePath}/${targetPath}`.replace(/\/+/g, "/");
  upstreamUrl.search = requestUrl.search;
  return upstreamUrl;
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

export async function proxyToClickproApi(request: Request, pathSegments: string[]) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const debug = isDevelopment || process.env.DEBUG_API_PROXY === 'true';

  try {
    if (debug) {
      console.log('[apiProxy] Request method:', request.method);
      console.log('[apiProxy] Path segments:', pathSegments);
      console.log('[apiProxy] Request URL:', request.url);
    }

    // --- 1. Validate clientId in path ---
    const clientId = pathSegments.length > 0 ? pathSegments[0].trim() : null;
    if (debug) {
      console.log('[apiProxy] Client ID:', clientId);
    }

    if (!clientId) {
      console.error('[apiProxy] ERROR: Missing client ID in path');
      return new Response(
        JSON.stringify({
          error: "Client ID is required",
          details: "The path must include a client ID: /api/clients/{id}/...",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // --- 2. Validate Authorization header ---
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error('[apiProxy] ERROR: Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({
          error: "Autorização necessária",
          details: "Ative sua licença para obter um token JWT válido antes de salvar credenciais.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // --- 3. Resolve upstream URL ---
    const baseUrl = getUpstreamBaseUrl();
    if (debug) {
      console.log('[apiProxy] CLICKPRO_API_URL:', baseUrl || '(not set)');
    }

    const upstreamUrl = buildUpstreamUrl(request, pathSegments);
    if (!upstreamUrl) {
      console.error('[apiProxy] ERROR: CLICKPRO_API_URL not configured');
      return new Response(
        JSON.stringify({
          error: "CLICKPRO_API_URL not configured",
          details: "Configure a variável de ambiente CLICKPRO_API_URL nas configurações do Vercel (Project Settings > Environment Variables).",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // --- 4. Block private/localhost upstream targets ---
    if (isBlockedHost(upstreamUrl.hostname)) {
      console.error(
        '[apiProxy] BLOCKED: Upstream URL points to a private/localhost address:',
        upstreamUrl.hostname,
      );
      return new Response(
        JSON.stringify({
          error: "CLICKPRO_API_URL aponta para um endereço privado/localhost",
          details:
            "Configure CLICKPRO_API_URL com a URL pública do backend (ex: https://api.clickpro.com). " +
            "Endereço atual: " + upstreamUrl.origin,
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // --- 5. Detect self-referencing loop ---
    const requestHost = request.headers.get("host") || "";
    const forwardedHost = request.headers.get("x-forwarded-host") || "";
    const hostsToCheck = [requestHost, forwardedHost].filter(Boolean);
    if (hostsToCheck.some((h) => upstreamUrl.host === h)) {
      console.error(
        '[apiProxy] LOOP DETECTED: Upstream URL host matches request host:',
        upstreamUrl.host,
        '- CLICKPRO_API_URL must point to the external WhatsApp Integration API, not to this portal.',
      );
      return new Response(
        JSON.stringify({
          error: "Loop detected: CLICKPRO_API_URL points to this application",
          details:
            "Configure CLICKPRO_API_URL to point to the WhatsApp Integration API server (e.g., https://api.clickpro.com), not to this portal. " +
            "Current upstream: " + upstreamUrl.origin,
        }),
        { status: 508, headers: { "Content-Type": "application/json" } },
      );
    }

    if (debug) {
      console.log('[apiProxy] Upstream URL:', upstreamUrl.toString());
    }

    // --- 6. Forward request ---
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    if (request.headers.get("host")) {
      headers.set("x-forwarded-host", request.headers.get("host") as string);
    }

    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer();

    if (debug) {
      console.log('[apiProxy] Sending request to upstream...');
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });

    if (debug) {
      console.log('[apiProxy] Upstream response status:', upstreamResponse.status);
    }

    // --- 7. Handle upstream errors ---
    if (!upstreamResponse.ok) {
      const responseText = await upstreamResponse.text();
      console.error('[apiProxy] Upstream error response:', upstreamResponse.status, responseText);

      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: "Upstream error", details: responseText };
      }

      return new Response(
        JSON.stringify({
          error: `Upstream API returned ${upstreamResponse.status}`,
          details: errorData,
          upstreamStatus: upstreamResponse.status,
        }),
        {
          status: upstreamResponse.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // --- 8. Forward successful response ---
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");

    if (debug) {
      console.log('[apiProxy] Successful response, forwarding to client');
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[apiProxy] CRITICAL ERROR:', error);

    // Differentiate network errors from other errors
    if (isNetworkError(error)) {
      console.error('[apiProxy] Network error — backend may be down or unreachable');
      return new Response(
        JSON.stringify({
          error: "Cannot reach backend",
          details:
            "Não foi possível conectar ao backend ClickPro. Verifique se o servidor está rodando e acessível. " +
            "Endpoint: " + getUpstreamBaseUrl(),
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Internal proxy error",
        details: error instanceof Error ? error.message : String(error),
        ...(isDevelopment && { stack: error instanceof Error ? error.stack : undefined }),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
