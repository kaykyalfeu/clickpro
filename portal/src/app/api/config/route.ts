import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const cookieStore = cookies();
    const jwtToken = cookieStore.get("CLICKPRO_JWT")?.value ?? null;

    return NextResponse.json({
      ok: true,
      config: {
        baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "https://clickpro.grupogarciaseguradoras.com.br",
        clientId: session.user.clientId,
        licenseKey: "",
        token: jwtToken,
      },
    });
  } catch (error) {
    console.error("Error loading config:", error);
    return NextResponse.json({ error: "Erro ao carregar configuracoes" }, { status: 500 });
  }
}
