"use client";

import { useEffect, useState } from "react";
import ApiConfigCard from "@/components/ApiConfigCard";
import DashboardHeader from "@/components/DashboardHeader";

const defaultBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://clickpro.grupogarciaseguradoras.com.br";

export default function CredentialsPage() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);
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
    const storedJwt = localStorage.getItem("CLICKPRO_JWT");
    const stored = localStorage.getItem("clickpro-config");
    if (stored) {
      const config = JSON.parse(stored) as {
        baseUrl?: string;
        token?: string;
        clientId?: string;
        licenseKey?: string;
      };
      if (config.baseUrl) setBaseUrl(config.baseUrl);
      if (config.clientId) setClientId(config.clientId);
      if (config.licenseKey) setLicenseKey(config.licenseKey);
      if (!storedJwt && config.token) setToken(config.token);
    }
    if (storedJwt) setToken(storedJwt);
  }, []);

  function saveConfig() {
    localStorage.setItem("clickpro-config", JSON.stringify({
      baseUrl,
      token,
      clientId,
      licenseKey,
    }));
    if (token) localStorage.setItem("CLICKPRO_JWT", token);
    setFeedback("Configurações salvas localmente.");
  }

  async function activateLicense() {
    if (!licenseKey.trim()) {
      setActivationError("Informe a chave de licença.");
      return;
    }
    setActivationLoading(true);
    setActivationError(null);
    setActivationSuccess(null);
    try {
      const response = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setActivationError(data.error || data.reason || "Falha ao ativar licença.");
        return;
      }
      const resolvedClientId = data.clientId ?? clientId;
      setToken(data.token);
      if (resolvedClientId) setClientId(resolvedClientId);
      localStorage.setItem("CLICKPRO_JWT", data.token);
      localStorage.setItem("clickpro-config", JSON.stringify({
        baseUrl,
        token: data.token,
        clientId: resolvedClientId,
        licenseKey: licenseKey.trim(),
      }));
      setActivationSuccess("Licença ativada. JWT gerado automaticamente.");
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : "Erro ao ativar licença.");
    } finally {
      setActivationLoading(false);
    }
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

  async function fetchMetaTier() {
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/meta/tiers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao buscar tier.");
      setMetaTierLimit(String(data.metaTierLimit));
      setFeedback(`Tier Meta atualizado: ${data.tier}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar tier.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <DashboardHeader />

      <div className="border-b border-slate-800">
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
            licenseKey={licenseKey}
            setLicenseKey={setLicenseKey}
            onActivate={activateLicense}
            activationLoading={activationLoading}
            activationError={activationError}
            activationSuccess={activationSuccess}
            token={token}
            setToken={setToken}
            clientId={clientId}
            setClientId={setClientId}
            onSave={saveConfig}
          />
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-2">
        {/* Instruções iniciais com legendas */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold mb-2" title="Passos necessários para começar a usar o ClickPro">Primeiros Passos</h2>
          <p className="text-sm text-slate-400 mb-4">Siga as etapas abaixo para ativar sua conta:</p>
          <ol className="list-decimal list-inside text-sm text-slate-300 space-y-2">
            <li title="Necessário para a IA responder corretamente">
              <span className={status.openaiSet ? "text-emerald-400" : "text-slate-300"}>
                {status.openaiSet ? "✔️" : "1."} Cadastre suas credenciais da OpenAI
              </span>
            </li>
            <li title="Permite integrar sua conta do WhatsApp Business">
              <span className={status.whatsappSet ? "text-emerald-400" : "text-slate-300"}>
                {status.whatsappSet ? "✔️" : "2."} Cadastre as credenciais do WhatsApp Cloud API
              </span>
            </li>
            <li title="Limita a quantidade de requisições por dia, evite excessos">
              <span className="text-slate-300">3. Defina seus limites de uso diário</span>
            </li>
          </ol>

          {/* Alertas de campos essenciais faltando */}
          {!status.openaiSet && (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" title="Este campo precisa ser preenchido para continuar">
              ⚠️ Preencha suas credenciais da OpenAI para habilitar a IA.
            </div>
          )}
          {!status.whatsappSet && (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" title="Necessário para enviar mensagens pelo WhatsApp">
              ⚠️ Preencha suas credenciais do WhatsApp para enviar mensagens.
            </div>
          )}

          {/* Status geral */}
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="text-slate-400">Status geral:</span>
            {status.openaiSet && status.whatsappSet ? (
              <span className="text-emerald-400 font-medium" title="Todas as credenciais estão configuradas">✔️ Pronto para uso</span>
            ) : (
              <span className="text-red-400 font-medium" title="Complete os passos acima para começar">❌ Configuração incompleta</span>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" title="Configure sua chave de API da OpenAI para habilitar respostas com IA">OpenAI</h2>
            <span className={`text-xs ${status.openaiSet ? "text-emerald-400" : "text-red-400"}`}>
              {status.openaiSet ? "✅ válido" : "❌ inválido"}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-slate-400" title="Chave secreta da sua conta OpenAI, encontrada em platform.openai.com">API Key</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={(event) => setOpenaiKey(event.target.value)}
                  placeholder={status.openaiSet ? "••••••••••" : "sk-..."}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  title="Cole sua chave de API da OpenAI aqui"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey((prev) => !prev)}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300"
                  title={showOpenaiKey ? "Ocultar chave" : "Mostrar chave"}
                >
                  {showOpenaiKey ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500" title="Dica de onde encontrar">Encontre em: platform.openai.com → API Keys</p>
            </div>
            <div>
              <label className="text-xs text-slate-400" title="ID do assistente configurado no OpenAI Playground">Assistant ID</label>
              <input
                value={assistantId}
                onChange={(event) => setAssistantId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Cole o ID do seu assistente OpenAI (opcional)"
                placeholder="asst_..."
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de onde encontrar">Opcional: configure em platform.openai.com → Assistants</p>
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Instruções base para a IA seguir ao responder mensagens">Command Prompt</label>
              <textarea
                value={commandPrompt}
                onChange={(event) => setCommandPrompt(event.target.value)}
                className="mt-2 h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Defina instruções personalizadas para a IA (opcional)"
                placeholder="Ex: Você é um assistente de atendimento da empresa X..."
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de uso">Opcional: defina como a IA deve se comportar nas respostas</p>
            </div>
            <button
              type="button"
              onClick={saveOpenAi}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200"
              title="Salvar e validar credenciais da OpenAI"
            >
              Salvar OpenAI
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" title="Configure sua conta do WhatsApp Business para enviar mensagens">Meta WhatsApp</h2>
            <span className={`text-xs ${status.whatsappSet ? "text-emerald-400" : "text-red-400"}`} title={status.whatsappSet ? "Credenciais configuradas corretamente" : "Credenciais ainda não configuradas"}>
              {status.whatsappSet ? "✅ válido" : "❌ inválido"}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-slate-400" title="ID da sua conta de negócios no Meta Business Suite">Business ID</label>
              <input
                value={businessId}
                onChange={(event) => setBusinessId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Cole o ID da sua conta Meta Business"
                placeholder="123456789012345"
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de onde encontrar">Encontre em: business.facebook.com → Configurações → Informações da empresa</p>
            </div>
            <div>
              <label className="text-xs text-slate-400" title="ID do número de telefone cadastrado no WhatsApp Cloud API">Phone Number ID</label>
              <input
                value={phoneNumberId}
                onChange={(event) => setPhoneNumberId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Cole o ID do seu número de telefone WhatsApp"
                placeholder="123456789012345"
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de onde encontrar">Encontre em: developers.facebook.com → WhatsApp → Configuração da API</p>
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Seu número de telefone no formato internacional E.164">Cloud Number (E.164)</label>
              <input
                value={cloudNumber}
                onChange={(event) => setCloudNumber(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Digite seu número no formato internacional"
                placeholder="+5511999999999"
              />
              <p className="mt-1 text-xs text-slate-500" title="Formato do número">Formato: +[código país][DDD][número] sem espaços</p>
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Token de acesso permanente da API do WhatsApp">Access Token</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type={showMetaToken ? "text" : "password"}
                  value={metaToken}
                  onChange={(event) => setMetaToken(event.target.value)}
                  placeholder={status.whatsappSet ? "••••••••••" : "EAAD..."}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  title="Cole seu token de acesso da API Meta"
                />
                <button
                  type="button"
                  onClick={() => setShowMetaToken((prev) => !prev)}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300"
                  title={showMetaToken ? "Ocultar token" : "Mostrar token"}
                >
                  {showMetaToken ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500" title="Dica de onde encontrar">Gere em: developers.facebook.com → seu app → WhatsApp → Configuração da API</p>
            </div>
            <button
              type="button"
              onClick={saveWhatsApp}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200"
              title="Salvar e validar credenciais do WhatsApp"
            >
              Salvar WhatsApp
            </button>
            <button
              type="button"
              onClick={fetchMetaTier}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              title="Buscar automaticamente o tier de mensagens da sua conta Meta"
            >
              Buscar tier automaticamente
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold" title="Configure limites para controlar custos e evitar excesso de uso">Limites e Tier</h2>
          <p className="mt-2 text-sm text-slate-400" title="Esses limites protegem você de gastos inesperados">
            Controle de custo da IA e limite diário por Tier Meta.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-400" title="Quantidade máxima de chamadas à IA por dia">AI Daily Limit</label>
              <input
                value={aiDailyLimit}
                onChange={(event) => setAiDailyLimit(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Digite o limite máximo de requisições de IA por dia"
                placeholder="1000"
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de uso">Limite de chamadas à IA por dia (evita gastos excessivos)</p>
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Limite de mensagens conforme o tier da sua conta Meta">Meta Tier Limit (1k/10k/100k)</label>
              <input
                value={metaTierLimit}
                onChange={(event) => setMetaTierLimit(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Digite o limite do seu tier Meta ou use o botão de busca automática"
                placeholder="1000"
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de uso">Limite de mensagens por dia (baseado no tier da sua conta Meta)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={saveLimits}
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200"
            title="Salvar os limites configurados"
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
