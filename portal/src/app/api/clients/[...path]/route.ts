import { proxyToClickproApi } from "@/lib/apiProxy";

export async function GET(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToClickproApi(request, params.path ?? []);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToClickproApi(request, params.path ?? []);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToClickproApi(request, params.path ?? []);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToClickproApi(request, params.path ?? []);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToClickproApi(request, params.path ?? []);
}
