function getUpstreamBaseUrl() {
  // CRITICAL: Only use server-side env var CLICKPRO_API_URL
  // NEXT_PUBLIC_* variables are NOT available at runtime in API routes on Vercel
  // They are bundled at build time and only accessible in client-side code
  return process.env.CLICKPRO_API_URL || "";
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

export async function proxyToClickproApi(request: Request, pathSegments: string[]) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  try {
    // Log request details for debugging (only in development or when debug is enabled)
    if (isDevelopment || process.env.DEBUG_API_PROXY === 'true') {
      console.log('[apiProxy] Request method:', request.method);
      console.log('[apiProxy] Path segments:', pathSegments);
      console.log('[apiProxy] Request URL:', request.url);
    }

    // Validate path segments - extract clientId if present
    const clientId = pathSegments.length > 0 ? pathSegments[0].trim() : null;
    if (isDevelopment || process.env.DEBUG_API_PROXY === 'true') {
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

    const baseUrl = getUpstreamBaseUrl();
    if (isDevelopment || process.env.DEBUG_API_PROXY === 'true') {
      console.log('[apiProxy] Base URL:', baseUrl || '(not set)');
    }

    const upstreamUrl = buildUpstreamUrl(request, pathSegments);
    if (!upstreamUrl) {
      console.error('[apiProxy] ERROR: Failed to build upstream URL - CLICKPRO_API_URL not configured');
      return new Response(
        JSON.stringify({
          error: "CLICKPRO_API_URL não configurado no servidor",
          details: "Configure a variável de ambiente CLICKPRO_API_URL nas configurações do Vercel (Project Settings > Environment Variables).",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (isDevelopment || process.env.DEBUG_API_PROXY === 'true') {
      console.log('[apiProxy] Upstream URL:', upstreamUrl.toString());
    }

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    if (request.headers.get("host")) {
      headers.set("x-forwarded-host", request.headers.get("host") as string);
    }

    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer();

    if (isDevelopment || process.env.DEBUG_API_PROXY === 'true') {
      console.log('[apiProxy] Sending request to upstream...');
    }
    
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });

    if (isDevelopment || process.env.DEBUG_API_PROXY === 'true') {
      console.log('[apiProxy] Upstream response status:', upstreamResponse.status);
      console.log('[apiProxy] Upstream response ok:', upstreamResponse.ok);
    }

    // If response is not ok, log the response body for debugging
    if (!upstreamResponse.ok) {
      const responseText = await upstreamResponse.text();
      console.error('[apiProxy] Upstream error response body:', responseText);

      // Try to parse as JSON, otherwise return as text
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

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");

    if (isDevelopment || process.env.DEBUG_API_PROXY === 'true') {
      console.log('[apiProxy] Successful response, forwarding to client');
    }
    
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    // Catch any unexpected errors - always log these as they indicate real problems
    console.error('[apiProxy] CRITICAL ERROR:', error);
    console.error('[apiProxy] Error stack:', error instanceof Error ? error.stack : 'N/A');

    return new Response(
      JSON.stringify({
        error: "Internal proxy error",
        details: error instanceof Error ? error.message : String(error),
        // Only include stack trace in development to avoid leaking sensitive information
        ...(isDevelopment && { stack: error instanceof Error ? error.stack : undefined }),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
