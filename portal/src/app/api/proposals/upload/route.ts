import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Não autenticado" },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { message: "Tipo de arquivo inválido. Use PDF, JPG ou PNG." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: "Arquivo muito grande. Tamanho máximo: 10MB." },
        { status: 400 }
      );
    }

    // Convert file to base64 for simple storage
    // In production, this should upload to cloud storage (S3, Supabase Storage, etc.)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString("base64");

    // Create proposal document record
    const proposal = await prisma.proposalDocument.create({
      data: {
        userId: user.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileData: base64Data,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        message: "Proposta enviada com sucesso",
        proposalId: proposal.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { message: "Erro ao processar upload" },
      { status: 500 }
    );
  }
}
