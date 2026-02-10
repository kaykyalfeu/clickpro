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
  const upstreamUrl = buildUpstreamUrl(request, pathSegments);
  if (!upstreamUrl) {
    return new Response(
      JSON.stringify({
        error:
          "CLICKPRO_API_URL não configurado no servidor. Configure a variável de ambiente CLICKPRO_API_URL nas configurações do Vercel (Project Settings > Environment Variables).",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
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

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
