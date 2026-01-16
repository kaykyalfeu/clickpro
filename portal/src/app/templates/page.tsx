"use client";

import { useEffect, useState } from "react";
import ApiConfigCard from "@/components/ApiConfigCard";

interface TemplateItem {
  id: number;
  name: string;
  language: string;
  category: string;
  status: string;
  meta_template_id?: string | null;
  created_at: string;
}

const defaultBaseUrl = process.env.NEXT_PUBLIC_CLICKPRO_API_URL || "http://localhost:3001";

export default function TemplatesPage() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState("MARKETING");
  const [bodyText, setBodyText] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [submitToMeta, setSubmitToMeta] = useState(true);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function fetchTemplates() {
    if (!baseUrl || !clientId || !token) return;
    const response = await fetch(`${baseUrl}/api/clients/${clientId}/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = await response.json();
    setTemplates(data.templates || []);
  }

  useEffect(() => {
    fetchTemplates();
    const interval = setInterval(fetchTemplates, 30000);
    return () => clearInterval(interval);
  }, [baseUrl, token, clientId]);

  async function handleMediaUpload(file: File) {
    setError(null);
    setFeedback(null);
    setLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const stripped = result.split(",")[1] || "";
          resolve(stripped);
        };
        reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
        reader.readAsDataURL(file);
      });
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/templates/media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType: file.type,
          fileName: file.name,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao enviar mídia.");
      setMediaId(data.mediaId);
      setMediaPreview(URL.createObjectURL(file));
      setFeedback("Mídia enviada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTemplate() {
    setFeedback(null);
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/templates`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          language,
          category,
          bodyText,
          submit: submitToMeta,
          businessId,
          mediaId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao criar template.");
      setFeedback("Template criado com sucesso.");
      setName("");
      setBodyText("");
      setMediaId(null);
      setMediaPreview(null);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar template.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Gestão de Templates</h1>
            <p className="text-sm text-slate-400">
              Crie templates, envie para aprovação e acompanhe status.
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

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold">Novo Template</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-slate-400">Nome</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400">Idioma</label>
                <input
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Categoria</label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="MARKETING">MARKETING</option>
                  <option value="UTILITY">UTILITY</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Corpo</label>
              <textarea
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                className="mt-2 h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Business ID</label>
              <input
                value={businessId}
                onChange={(event) => setBusinessId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Mídia (opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleMediaUpload(file);
                }}
                className="mt-2 w-full text-sm text-slate-300"
              />
              {mediaPreview && (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="mt-3 h-32 rounded-xl border border-slate-700 object-cover"
                />
              )}
              {mediaId && (
                <p className="mt-2 text-xs text-slate-400">media_id: {mediaId}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={submitToMeta}
                onChange={(event) => setSubmitToMeta(event.target.checked)}
              />
              Submeter para aprovação
            </label>
            <button
              type="button"
              onClick={handleCreateTemplate}
              disabled={loading}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200 disabled:opacity-50"
            >
              Criar template
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold">Templates Existentes</h2>
          <div className="mt-4 space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{template.name}</p>
                    <p className="text-xs text-slate-400">
                      {template.language} • {template.category}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {template.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(template.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        {(feedback || error) && (
          <div className={`rounded-2xl border px-4 py-3 text-sm lg:col-span-2 ${
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
