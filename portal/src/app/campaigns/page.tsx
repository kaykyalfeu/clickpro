"use client";

import { useEffect, useMemo, useState } from "react";
import ApiConfigCard from "@/components/ApiConfigCard";

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
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Painel de Campanhas</h1>
            <p className="text-sm text-slate-400">Crie campanhas e monitore progresso de envios.</p>
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

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold">Nova Campanha</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-slate-400">Nome</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Template aprovado</label>
              <select
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {approvedTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Rate limit (msg/min)</label>
              <input
                value={rateLimit}
                onChange={(event) => setRateLimit(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Selecionar contatos</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou telefone"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3">
                {contacts.map((contact) => (
                  <label key={contact.id} className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                    />
                    <span>{contact.name || contact.phone}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={createCampaign}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200"
            >
              Criar campanha
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold">Histórico</h2>
          <div className="mt-4 space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{campaign.name}</p>
                    <p className="text-xs text-slate-400">Status: {campaign.status}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {campaign.sent_contacts}/{campaign.total_contacts}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
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
