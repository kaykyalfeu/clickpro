import { proxyToClickproApi } from "@/lib/apiProxy";

export async function GET(request: Request) {
  return proxyToClickproApi(request, []);
}

export async function POST(request: Request) {
  return proxyToClickproApi(request, []);
}

export async function PATCH(request: Request) {
  return proxyToClickproApi(request, []);
}

export async function PUT(request: Request) {
  return proxyToClickproApi(request, []);
}

export async function DELETE(request: Request) {
  return proxyToClickproApi(request, []);
}
