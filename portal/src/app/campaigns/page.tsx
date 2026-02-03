"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import ApiConfigCard from "@/components/ApiConfigCard";
import ContactsEmptyState from "@/components/ContactsEmptyState";
import DashboardHeader from "@/components/DashboardHeader";

interface TemplateItem {
  id: number;
  name: string;
  status: string;
  created_at: string;
}

interface ContactItem {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
}

interface CampaignItem {
  id: number;
  name: string;
  status: string;
  rate_limit: number;
  created_at: string;
  total_contacts: number;
  sent_contacts: number;
}

const defaultBaseUrl = process.env.NEXT_PUBLIC_CLICKPRO_API_URL || "http://localhost:3001";

export default function CampaignsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [rateLimit, setRateLimit] = useState("20");
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canImportContacts =
    sessionStatus === "authenticated" &&
    (session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "CLIENT_ADMIN");

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

  async function fetchContacts() {
    if (!baseUrl || !clientId || !token) return;
    const response = await fetch(
      `${baseUrl}/api/clients/${clientId}/contacts?search=${encodeURIComponent(search)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) return;
    const data = await response.json();
    setContacts(data.contacts || []);
  }

  async function fetchCampaigns() {
    if (!baseUrl || !clientId || !token) return;
    const response = await fetch(`${baseUrl}/api/clients/${clientId}/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = await response.json();
    setCampaigns(data.campaigns || []);
  }

  useEffect(() => {
    fetchTemplates();
    fetchContacts();
    fetchCampaigns();
  }, [baseUrl, token, clientId]);

  useEffect(() => {
    const timeout = setTimeout(fetchContacts, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const approvedTemplates = useMemo(
    () => templates.filter((template) => template.status === "APPROVED" || template.status === "approved"),
    [templates],
  );

  async function createCampaign() {
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/campaigns`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          templateId: Number(templateId),
          contactIds: selectedContacts,
          rateLimit: Number(rateLimit),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao criar campanha.");
      setFeedback("Campanha criada e agendada.");
      setName("");
      setSelectedContacts([]);
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar campanha.");
    }
  }

  function toggleContact(id: number) {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <DashboardHeader />

      <div className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold" title="Área para criar campanhas e enviar mensagens em massa">Painel de Campanhas</h1>
            <p className="text-sm text-slate-400" title="Gerencie todas as suas campanhas de WhatsApp aqui">Crie campanhas e monitore progresso de envios.</p>
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
      </div>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1.2fr_1fr]">
        {/* Checklist para criar campanha */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold mb-2" title="Área para criar campanhas e enviar mensagens em massa">Criar Campanha</h2>
          <p className="text-sm text-slate-400 mb-4" title="Verifique os requisitos antes de criar uma campanha">Checklist para criar campanha:</p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2" title="Você precisa criar e aprovar um template antes de usá-lo">
              <span className={approvedTemplates.length > 0 ? "text-emerald-400" : "text-red-400"}>
                {approvedTemplates.length > 0 ? "✔️" : "❌"}
              </span>
              <span className={approvedTemplates.length > 0 ? "text-slate-300" : "text-slate-400"}>
                Template aprovado
                {approvedTemplates.length === 0 && (
                  <span className="text-xs text-slate-500 ml-2">(vá para Templates e crie um)</span>
                )}
              </span>
            </li>
            <li className="flex items-center gap-2" title="Você deve importar ao menos um contato">
              <span className={contacts.length > 0 ? "text-emerald-400" : "text-red-400"}>
                {contacts.length > 0 ? "✔️" : "❌"}
              </span>
              <span className={contacts.length > 0 ? "text-slate-300" : "text-slate-400"}>
                Contatos importados
                {contacts.length === 0 && (
                  <span className="text-xs text-slate-500 ml-2">(vá para Contatos e importe um CSV)</span>
                )}
              </span>
            </li>
          </ul>
          {approvedTemplates.length > 0 && contacts.length > 0 && (
            <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" title="Você está pronto para criar campanhas">
              ✔️ Pronto! Você pode criar sua primeira campanha.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold" title="Formulário para criar uma nova campanha">Nova Campanha</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-slate-400" title="Nome para identificar sua campanha">Nome</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Digite um nome descritivo para sua campanha"
                placeholder="Ex: Promoção de Janeiro 2024"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Selecione um template aprovado para enviar">Template aprovado</label>
              <select
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Escolha o template de mensagem para esta campanha"
              >
                <option value="">Selecione</option>
                {approvedTemplates.map((template) => (
                  <option key={template.id} value={template.id} title={`Template: ${template.name}`}>
                    {template.name}
                  </option>
                ))}
              </select>
              {approvedTemplates.length === 0 && (
                <p className="mt-1 text-xs text-amber-400" title="Você precisa de um template aprovado">⚠️ Nenhum template aprovado disponível</p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Quantidade máxima de mensagens enviadas por minuto">Rate limit (msg/min)</label>
              <input
                value={rateLimit}
                onChange={(event) => setRateLimit(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Defina quantas mensagens enviar por minuto (evita bloqueio)"
                placeholder="20"
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de rate limit">Recomendado: 20-30 msg/min para evitar bloqueios</p>
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Escolha quais contatos receberão esta campanha">Selecionar contatos</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou telefone"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                title="Digite para filtrar contatos"
              />
              <p className="mt-1 text-xs text-slate-500" title="Informação de seleção">
                {selectedContacts.length} contato(s) selecionado(s)
              </p>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3">
                {contacts.length === 0 && (
                  <ContactsEmptyState
                    canImportContacts={canImportContacts}
                    showPermissionMessage={sessionStatus === "authenticated"}
                    importHref="/contacts"
                  />
                )}
                {contacts.map((contact) => (
                  <label key={contact.id} className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer hover:bg-slate-900 rounded px-2 py-1" title={`Selecionar ${contact.name || contact.phone}`}>
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                      title={selectedContacts.includes(contact.id) ? "Clique para remover" : "Clique para selecionar"}
                    />
                    <span>{contact.name || contact.phone}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={createCampaign}
              disabled={!name || !templateId || selectedContacts.length === 0}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!name || !templateId || selectedContacts.length === 0 ? "Preencha todos os campos para criar" : "Criar e agendar a campanha"}
            >
              Criar campanha
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold" title="Histórico de todas as suas campanhas">Histórico</h2>
          <p className="mt-1 text-xs text-slate-500" title="Informação sobre as campanhas">Acompanhe o progresso de envio das suas campanhas</p>
          <div className="mt-4 space-y-3">
            {campaigns.length === 0 && (
              <p className="text-sm text-slate-400" title="Nenhuma campanha criada ainda">Nenhuma campanha criada. Crie sua primeira campanha ao lado.</p>
            )}
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4" title="Detalhes da campanha">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white" title="Nome da campanha">{campaign.name}</p>
                    <p className="text-xs text-slate-400" title={`Status atual: ${campaign.status}`}>
                      Status:{" "}
                      <span className={
                        campaign.status === "completed" ? "text-emerald-400" :
                        campaign.status === "running" ? "text-blue-400" :
                        campaign.status === "failed" ? "text-red-400" :
                        "text-slate-300"
                      }>
                        {campaign.status === "completed" ? "✔️ Concluída" :
                         campaign.status === "running" ? "🔄 Em andamento" :
                         campaign.status === "failed" ? "❌ Falhou" :
                         campaign.status}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-slate-400" title={`${campaign.sent_contacts} de ${campaign.total_contacts} mensagens enviadas`}>
                    {campaign.sent_contacts}/{campaign.total_contacts}
                  </span>
                </div>
                {/* Barra de progresso */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800" title={`Progresso: ${Math.round((campaign.sent_contacts / campaign.total_contacts) * 100)}%`}>
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${(campaign.sent_contacts / campaign.total_contacts) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500" title="Data de criação da campanha">
                  {new Date(campaign.created_at).toLocaleString()}
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
