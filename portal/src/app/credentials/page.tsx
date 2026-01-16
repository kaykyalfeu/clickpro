"use client";

import { useEffect, useState } from "react";
import ApiConfigCard from "@/components/ApiConfigCard";

const defaultBaseUrl = process.env.NEXT_PUBLIC_CLICKPRO_API_URL || "http://localhost:3001";

export default function CredentialsPage() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [commandPrompt, setCommandPrompt] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [cloudNumber, setCloudNumber] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [aiDailyLimit, setAiDailyLimit] = useState("1000");
  const [metaTierLimit, setMetaTierLimit] = useState("1000");
  const [status, setStatus] = useState({ openaiSet: false, whatsappSet: false });
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showMetaToken, setShowMetaToken] = useState(false);
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

  async function fetchStatus() {
    if (!baseUrl || !clientId || !token) return;
    const response = await fetch(`${baseUrl}/api/clients/${clientId}/credentials/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = await response.json();
    setStatus({ openaiSet: data.openaiSet, whatsappSet: data.whatsappSet });
    if (data.aiDailyLimit) setAiDailyLimit(String(data.aiDailyLimit));
    if (data.metaTierLimit) setMetaTierLimit(String(data.metaTierLimit));
  }

  useEffect(() => {
    fetchStatus();
  }, [baseUrl, token, clientId]);

  async function saveOpenAi() {
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/credentials/openai`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: openaiKey,
          assistantId,
          commandPrompt,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao salvar OpenAI.");
      setFeedback("Credenciais OpenAI salvas e validadas.");
      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar OpenAI.");
    }
  }

  async function saveWhatsApp() {
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/credentials/whatsapp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: metaToken,
          phoneNumberId,
          cloudNumber,
          businessId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao salvar WhatsApp.");
      setFeedback("Credenciais WhatsApp salvas e validadas.");
      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar WhatsApp.");
    }
  }

  async function saveLimits() {
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/limits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aiDailyLimit: Number(aiDailyLimit),
          metaTierLimit: Number(metaTierLimit),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao atualizar limites.");
      setFeedback("Limites atualizados com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar limites.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Painel de Credenciais</h1>
            <p className="text-sm text-slate-400">
              Cadastre credenciais Meta e OpenAI com validação automática.
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

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">OpenAI</h2>
            <span className={`text-xs ${status.openaiSet ? "text-emerald-400" : "text-red-400"}`}>
              {status.openaiSet ? "✅ válido" : "❌ inválido"}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-slate-400">API Key</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={(event) => setOpenaiKey(event.target.value)}
                  placeholder={status.openaiSet ? "••••••••••" : "sk-..."}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey((prev) => !prev)}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300"
                >
                  {showOpenaiKey ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Assistant ID</label>
              <input
                value={assistantId}
                onChange={(event) => setAssistantId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Command Prompt</label>
              <textarea
                value={commandPrompt}
                onChange={(event) => setCommandPrompt(event.target.value)}
                className="mt-2 h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={saveOpenAi}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200"
            >
              Salvar OpenAI
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Meta WhatsApp</h2>
            <span className={`text-xs ${status.whatsappSet ? "text-emerald-400" : "text-red-400"}`}>
              {status.whatsappSet ? "✅ válido" : "❌ inválido"}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-slate-400">Business ID</label>
              <input
                value={businessId}
                onChange={(event) => setBusinessId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Phone Number ID</label>
              <input
                value={phoneNumberId}
                onChange={(event) => setPhoneNumberId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Cloud Number (E.164)</label>
              <input
                value={cloudNumber}
                onChange={(event) => setCloudNumber(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Access Token</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type={showMetaToken ? "text" : "password"}
                  value={metaToken}
                  onChange={(event) => setMetaToken(event.target.value)}
                  placeholder={status.whatsappSet ? "••••••••••" : "EAAD..."}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowMetaToken((prev) => !prev)}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300"
                >
                  {showMetaToken ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={saveWhatsApp}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200"
            >
              Salvar WhatsApp
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">Limites e Tier</h2>
          <p className="mt-2 text-sm text-slate-400">
            Controle de custo da IA e limite diário por Tier Meta.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-400">AI Daily Limit</label>
              <input
                value={aiDailyLimit}
                onChange={(event) => setAiDailyLimit(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Meta Tier Limit (1k/10k/100k)</label>
              <input
                value={metaTierLimit}
                onChange={(event) => setMetaTierLimit(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={saveLimits}
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200"
          >
            Atualizar limites
          </button>
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
