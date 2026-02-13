// Returns upstream API configuration status (host only, no secrets)

export const runtime = "nodejs";

function normaliseUrl(raw: string): string {
  let url = raw.trim();
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim();
  }
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, "");
  return url;
}

export async function GET() {
  const raw = process.env.CLICKPRO_API_URL ?? "";
  if (!raw.trim()) {
    return Response.json({ configured: false, host: null });
  }

  try {
    const parsed = new URL(normaliseUrl(raw));
    return Response.json({ configured: true, host: parsed.host });
  } catch {
    return Response.json({ configured: false, host: null });
  }
}
