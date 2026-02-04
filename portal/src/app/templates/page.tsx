"use client";

import { useEffect, useState } from "react";
import ApiConfigCard from "@/components/ApiConfigCard";
import DashboardHeader from "@/components/DashboardHeader";
import { formatActivationError } from "@/lib/license";

interface TemplateItem {
  id: number;
  name: string;
  language: string;
  category: string;
  status: string;
  meta_template_id?: string | null;
  created_at: string;
}

const defaultBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://clickpro.grupogarciaseguradoras.com.br";

export default function TemplatesPage() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);
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
        setActivationError(formatActivationError(data));
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
      <DashboardHeader />

      <div className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold" title="Gerencie seus modelos de mensagem para campanhas do WhatsApp">Gestão de Templates</h1>
            <p className="text-sm text-slate-400" title="Templates precisam ser aprovados pela Meta antes de serem usados em campanhas">
              Crie templates, envie para aprovação e acompanhe status.
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

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Instruções iniciais */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold mb-2" title="Crie modelos prontos de mensagem para campanhas">Crie um template de mensagem</h2>
          <p className="text-sm text-slate-400 mb-4" title="Sem templates aprovados você não consegue enviar campanhas">
            Você precisa de pelo menos um template aprovado pelo WhatsApp para iniciar campanhas.
          </p>
          <div className="text-sm text-slate-300 space-y-2">
            <p title="Etapas para criar um template">Como funciona:</p>
            <ol className="list-decimal list-inside text-slate-400 space-y-1">
              <li title="Primeiro passo">Preencha os dados do template abaixo</li>
              <li title="Segundo passo">Submeta para aprovação da Meta</li>
              <li title="Terceiro passo">Aguarde a aprovação (pode levar de minutos a horas)</li>
              <li title="Quarto passo">Use o template aprovado nas suas campanhas</li>
            </ol>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold" title="Formulário para criar um novo template de mensagem">Novo Template</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-slate-400" title="Nome único para identificar seu template">Nome</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Digite um nome único para o template (sem espaços, use underline)"
                placeholder="meu_template_promocao"
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de formatação">Use apenas letras minúsculas, números e underline (_)</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400" title="Idioma do template (código ISO)">Idioma</label>
                <input
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  title="Código do idioma no formato ISO (ex: pt_BR)"
                  placeholder="pt_BR"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400" title="Categoria define como o WhatsApp trata seu template">Categoria</label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  title="Selecione a categoria adequada para seu template"
                >
                  <option value="MARKETING" title="Para promoções, ofertas e novidades">MARKETING</option>
                  <option value="UTILITY" title="Para confirmações, atualizações e alertas">UTILITY</option>
                  <option value="AUTHENTICATION" title="Para códigos de verificação e login">AUTHENTICATION</option>
                </select>
                <p className="mt-1 text-xs text-slate-500" title="Dica de categoria">Marketing: promoções | Utility: confirmações | Auth: códigos</p>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Texto principal da mensagem que será enviada">Corpo</label>
              <textarea
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                className="mt-2 h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Digite o texto da mensagem. Use {{1}}, {{2}} para variáveis"
                placeholder="Olá {{1}}, sua promoção de {{2}} está disponível!"
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de variáveis">Use {"{{1}}"}, {"{{2}}"} etc. para campos que variam por contato</p>
            </div>
            <div>
              <label className="text-xs text-slate-400" title="ID da sua conta Meta Business para enviar o template">Business ID</label>
              <input
                value={businessId}
                onChange={(event) => setBusinessId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Cole o ID da sua conta Meta Business"
                placeholder="123456789012345"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Imagem opcional para o cabeçalho do template">Mídia (opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleMediaUpload(file);
                }}
                className="mt-2 w-full text-sm text-slate-300"
                title="Selecione uma imagem para o cabeçalho do template"
              />
              <p className="mt-1 text-xs text-slate-500" title="Formatos aceitos">Formatos aceitos: JPG, PNG (max 5MB)</p>
              {mediaPreview && (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="mt-3 h-32 rounded-xl border border-slate-700 object-cover"
                  title="Prévia da imagem selecionada"
                />
              )}
              {mediaId && (
                <p className="mt-2 text-xs text-slate-400" title="ID da mídia no servidor Meta">media_id: {mediaId}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300" title="Marque para enviar automaticamente para aprovação da Meta">
              <input
                type="checkbox"
                checked={submitToMeta}
                onChange={(event) => setSubmitToMeta(event.target.checked)}
                title="Se marcado, o template será enviado para aprovação imediatamente"
              />
              Submeter para aprovação
            </label>
            <button
              type="button"
              onClick={handleCreateTemplate}
              disabled={loading}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200 disabled:opacity-50"
              title="Criar o template e enviar para aprovação se marcado"
            >
              Criar template
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold" title="Lista de todos os seus templates criados">Templates Existentes</h2>
          <p className="mt-1 text-xs text-slate-500" title="Informação de atualização">Atualiza automaticamente a cada 30 segundos</p>
          <div className="mt-4 space-y-3">
            {templates.length === 0 && (
              <p className="text-sm text-slate-400" title="Nenhum template criado ainda">Nenhum template encontrado. Crie seu primeiro template ao lado.</p>
            )}
            {templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4" title="Status e detalhes do seu modelo de mensagem">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white" title="Nome do template">{template.name}</p>
                    <p className="text-xs text-slate-400" title="Idioma e categoria do template">
                      {template.language} • {template.category}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      template.status === "APPROVED"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : template.status === "REJECTED"
                        ? "border-red-500/40 bg-red-500/10 text-red-400"
                        : "border-slate-700 text-slate-300"
                    }`}
                    title={
                      template.status === "APPROVED"
                        ? "Template aprovado e pronto para uso em campanhas"
                        : template.status === "REJECTED"
                        ? "Template rejeitado pela Meta, revise o conteúdo"
                        : "Aguardando análise da Meta"
                    }
                  >
                    {template.status === "APPROVED" ? "✔️ Aprovado" : template.status === "REJECTED" ? "❌ Rejeitado" : template.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500" title="Data de criação do template">
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
