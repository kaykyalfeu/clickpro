"use client";

import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";

export default function PropostasPage() {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleIniciarEnvio = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!validTypes.includes(file.type)) {
      setErrorMessage("Tipo de arquivo inválido. Use PDF, JPG ou PNG.");
      setUploadStatus("error");
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setErrorMessage("Arquivo muito grande. Tamanho máximo: 10MB.");
      setUploadStatus("error");
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
    setUploadStatus("idle");
  };

  const handleEnviarProposta = async () => {
    if (!selectedFile) return;

    setUploadStatus("uploading");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/proposals/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao enviar proposta");
      }

      setUploadStatus("success");
      setSelectedFile(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao enviar proposta"
      );
      setUploadStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Header */}
      <DashboardHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Propostas</h2>
          <p className="text-slate-400 mt-1">
            Envie e gerencie propostas para seus clientes
          </p>
        </div>

        {/* Enviar Proposta Card */}
        <section className="mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Enviar Proposta
            </h3>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* File selection UI */}
            <div className="space-y-4">
              {!selectedFile ? (
                <button
                  onClick={handleIniciarEnvio}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Iniciar envio
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <p className="text-slate-300 text-sm mb-1">
                      Arquivo selecionado:
                    </p>
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Tamanho: {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleEnviarProposta}
                      disabled={uploadStatus === "uploading"}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    >
                      {uploadStatus === "uploading"
                        ? "Enviando..."
                        : "Confirmar envio"}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      disabled={uploadStatus === "uploading"}
                      className="px-6 py-3 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {uploadStatus === "success" && (
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                  <p className="text-green-400 font-medium">
                    ✓ Proposta enviada com sucesso!
                  </p>
                </div>
              )}

              {uploadStatus === "error" && errorMessage && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                  <p className="text-red-400 font-medium">✗ {errorMessage}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Info Section */}
        <section className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
          <h4 className="text-white font-medium mb-2">Instruções</h4>
          <ul className="text-slate-400 text-sm space-y-1 list-disc list-inside">
            <li>Formatos aceitos: PDF, JPG, PNG</li>
            <li>Tamanho máximo: 10MB por arquivo</li>
            <li>As propostas ficam associadas ao seu usuário</li>
          </ul>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-sm text-slate-500 text-center">
            &copy; {new Date().getFullYear()} ClickPro Portal. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
