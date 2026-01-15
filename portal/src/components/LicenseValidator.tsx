"use client";

import { useState } from "react";

interface ValidationResult {
  valid: boolean;
  expiresAt?: string;
  reason?: string;
}

export default function LicenseValidator() {
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!licenseKey.trim()) {
      setError("Informe a chave de licença");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/license/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Falha ao validar licença");
      }

      setResult({
        valid: data.valid,
        expiresAt: data.expiresAt,
        reason: data.reason,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Validar Licença</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">
            Chave de Licença
          </label>
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Cole a chave de licença aqui"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Validando..." : "Validar"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            result.valid
              ? "bg-emerald-500/20 border border-emerald-500/50"
              : "bg-red-500/20 border border-red-500/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                result.valid ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            <p
              className={`font-medium ${
                result.valid ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {result.valid ? "Licença válida" : "Licença inválida"}
            </p>
          </div>

          {result.expiresAt && (
            <p className="text-slate-400 text-sm mt-2">
              Expira em: {new Date(result.expiresAt).toLocaleDateString("pt-BR")}
            </p>
          )}

          {result.reason && (
            <p className="text-slate-400 text-sm mt-1">Motivo: {result.reason}</p>
          )}
        </div>
      )}
    </div>
  );
}
