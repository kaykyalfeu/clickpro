"use client";

import { useEffect, useState } from "react";
import ApiConfigCard from "@/components/ApiConfigCard";

interface PreviewRow {
  name?: string;
  phone?: string;
  email?: string;
}

const defaultBaseUrl = process.env.NEXT_PUBLIC_CLICKPRO_API_URL || "http://localhost:3001";

export default function ContactsPage() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("clickpro-config");
    if (stored) {
      const config = JSON.parse(stored) as { baseUrl?: string; token?: string; clientId?: string };
      if (config.baseUrl) setBaseUrl(config.baseUrl);
      if (config.token) setToken(config.token);
      if (config.clientId) setClientId(config.clientId);
    }
  }, []);

  function saveConfig() {
    localStorage.setItem(
      "clickpro-config",
      JSON.stringify({ baseUrl, token, clientId }),
    );
    setFeedback("Configurações salvas localmente.");
  }

  function parseCsvPreview(text: string) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
    return lines.slice(1, 6).map((line) => {
      const values = line.split(",");
      const row: PreviewRow = {};
      headers.forEach((header, index) => {
        if (header.includes("name") || header.includes("nome")) row.name = values[index];
        if (header.includes("phone") || header.includes("telefone") || header.includes("numero")) {
          row.phone = values[index];
        }
        if (header.includes("email")) row.email = values[index];
      });
      return row;
    });
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setCsvText(text);
    setPreviewRows(parseCsvPreview(text));
  }

  async function uploadContacts() {
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/contacts/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao importar contatos.");
      setFeedback(`Importados ${data.inserted} contatos (de ${data.total}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar contatos.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Upload de Contatos</h1>
            <p className="text-sm text-slate-400">
              Faça upload CSV, valide e dedupe contatos antes das campanhas.
            </p>
          </div>
          <ApiConfigCard
            baseUrl={baseUrl}
            setBaseUrl={setBaseUrl}
            token={token}
            setToken={setToken}
            clientId={clientId}
            setClientId={setClientId}
            onSave={saveConfig}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold">Importação</h2>
          <div className="mt-4 space-y-4">
            <input
              type="file"
              accept=".csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="text-sm text-slate-300"
            />
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              className="h-40 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Cole o conteúdo CSV aqui"
            />
            <button
              type="button"
              onClick={uploadContacts}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200"
            >
              Importar contatos
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold">Prévia (primeiras linhas)</h2>
          <div className="mt-4 space-y-3">
            {previewRows.map((row, index) => (
              <div key={index} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm">
                <p>{row.name || "(sem nome)"}</p>
                <p className="text-xs text-slate-400">{row.phone}</p>
                <p className="text-xs text-slate-500">{row.email}</p>
              </div>
            ))}
          </div>
        </section>

        {(feedback || error) && (
          <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          }`}>
            {error || feedback}
          </div>
        )}
      </main>
    </div>
  );
}
