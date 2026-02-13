export const runtime = "nodejs";

export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "clickpro-portal",
      timestamp: new Date().toISOString(),
      runtime: process.env.NEXT_RUNTIME ?? "nodejs",
      upstreamConfigured: Boolean(process.env.CLICKPRO_API_URL?.trim()),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
