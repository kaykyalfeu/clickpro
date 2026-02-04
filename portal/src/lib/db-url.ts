import "server-only";

function truthyEnv(value: string | undefined) {
  return value?.toLowerCase() === "true";
}

function falseyEnv(value: string | undefined) {
  return value?.toLowerCase() === "false";
}

export function normalizeDbUrl(rawUrl: string | undefined) {
  if (!rawUrl) {
    return rawUrl;
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const params = url.searchParams;
  const useLibpqCompat = truthyEnv(process.env.PG_USE_LIBPQ_COMPAT);
  const relaxInvalidCerts = falseyEnv(process.env.PG_SSL_REJECT_UNAUTHORIZED);

  if (useLibpqCompat) {
    params.set("uselibpqcompat", "true");
    params.set("sslmode", "require");
  } else if (!params.has("sslmode")) {
    params.set("sslmode", "verify-full");
  }

  if (relaxInvalidCerts) {
    params.set("sslaccept", "accept_invalid_certs");
    params.set("sslmode", "require");
  }

  return url.toString();
}
