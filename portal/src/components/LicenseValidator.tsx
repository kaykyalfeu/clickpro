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
    <div
      className="border rounded-2xl p-6"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: `0 1px 3px var(--shadow)`,
      }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text)" }}>
        Validar Licença
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
            Chave de Licença
          </label>
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Cole a chave de licença aqui"
            className="w-full px-4 py-2 rounded-lg border focus:outline-none font-mono text-sm"
            style={{
              backgroundColor: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--surface-2)",
            color: "var(--text)",
            borderColor: "var(--border)",
            border: "1px solid",
          }}
        >
          {loading ? "Validando..." : "Validar"}
        </button>
      </form>

      {error && (
        <div
          className="mt-4 p-3 rounded-lg border text-sm"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderColor: "rgba(239, 68, 68, 0.3)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          className={`mt-4 p-4 rounded-lg border`}
          style={{
            backgroundColor: result.valid
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
            borderColor: result.valid
              ? "rgba(34, 197, 94, 0.3)"
              : "rgba(239, 68, 68, 0.3)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: result.valid ? "var(--success)" : "var(--danger)",
              }}
            />
            <p
              className="font-medium"
              style={{
                color: result.valid ? "var(--success)" : "var(--danger)",
              }}
            >
              {result.valid ? "Licença válida" : "Licença inválida"}
            </p>
          </div>

          {result.expiresAt && (
            <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
              Expira em: {new Date(result.expiresAt).toLocaleDateString("pt-BR")}
            </p>
          )}

          {result.reason && (
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Motivo: {result.reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
