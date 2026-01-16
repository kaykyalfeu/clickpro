"use client";

import { useEffect, useMemo, useState } from "react";
import ApiConfigCard from "@/components/ApiConfigCard";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  last_message: string | null;
  last_at: string | null;
}

interface Message {
  id: number;
  direction: string;
  content: string;
  source: string;
  status: string;
  created_at: string;
  phone: string | null;
}

const defaultBaseUrl = process.env.NEXT_PUBLIC_CLICKPRO_API_URL || "http://localhost:3001";

export default function ConversationsPage() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [outboundMessage, setOutboundMessage] = useState("");
  const [error, setError] = useState("");
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
  }

  async function fetchConversations() {
    if (!baseUrl || !clientId || !token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${baseUrl}/api/clients/${clientId}/conversations?search=${encodeURIComponent(search)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        throw new Error("Falha ao carregar conversas.");
      }
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar conversas.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages(phone: string) {
    if (!baseUrl || !clientId || !token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${baseUrl}/api/clients/${clientId}/messages?phone=${encodeURIComponent(phone)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        throw new Error("Falha ao carregar mensagens.");
      }
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mensagens.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!selectedPhone || !outboundMessage.trim()) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: selectedPhone, message: outboundMessage }),
      });
      if (!response.ok) {
        throw new Error("Falha ao enviar mensagem.");
      }
      setOutboundMessage("");
      await fetchMessages(selectedPhone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchConversations();
    }, 350);
    return () => clearTimeout(timeout);
  }, [baseUrl, token, clientId, search]);

  useEffect(() => {
    if (selectedPhone) {
      fetchMessages(selectedPhone);
    }
  }, [selectedPhone]);

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      const directionOk = directionFilter === "all" || message.direction === directionFilter;
      const sourceOk = sourceFilter === "all" || message.source === sourceFilter;
      const statusOk = statusFilter === "all" || message.status === statusFilter;
      return directionOk && sourceOk && statusOk;
    });
  }, [messages, directionFilter, sourceFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Inbox de Conversas</h1>
            <p className="text-sm text-slate-400">
              Acompanhe mensagens, filtre histórico e responda manualmente.
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

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="mb-4">
            <label className="text-xs text-slate-400">Buscar contato</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou telefone"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          {loading && (
            <p className="text-xs text-slate-500">Carregando conversas...</p>
          )}
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedPhone(conversation.phone)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selectedPhone === conversation.phone
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-slate-800 bg-slate-950"
                }`}
              >
                <p className="text-sm font-semibold">
                  {conversation.name || conversation.phone}
                </p>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                  {conversation.last_message || "Sem mensagens ainda"}
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {conversation.last_at ? new Date(conversation.last_at).toLocaleString() : ""}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Histórico</h2>
              <p className="text-xs text-slate-400">
                {selectedPhone ? `Contato: ${selectedPhone}` : "Selecione um contato"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-300">
              <select
                value={directionFilter}
                onChange={(event) => setDirectionFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              >
                <option value="all">Direção</option>
                <option value="INBOUND">Inbound</option>
                <option value="OUTBOUND">Outbound</option>
                <option value="STATUS">Status</option>
              </select>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              >
                <option value="all">Fonte</option>
                <option value="AI">IA</option>
                <option value="HUMAN">Humano</option>
                <option value="AGENT">Agente</option>
                <option value="WEBHOOK">Webhook</option>
                <option value="CAMPAIGN">Campanha</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              >
                <option value="all">Status</option>
                <option value="RECEIVED">Received</option>
                <option value="QUEUED">Queued</option>
                <option value="SENT">Sent</option>
                <option value="READ">Read</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="mt-6 max-h-[420px] space-y-3 overflow-y-auto pr-2">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border px-4 py-3 ${
                  message.direction === "OUTBOUND"
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-slate-800 bg-slate-950"
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{message.direction}</span>
                  <span>{new Date(message.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm text-slate-100">{message.content}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  <span className="rounded-full bg-slate-800 px-2 py-1">{message.source}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-1">{message.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <label className="text-xs text-slate-400">Nova mensagem</label>
            <textarea
              value={outboundMessage}
              onChange={(event) => setOutboundMessage(event.target.value)}
              className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Escreva uma mensagem manual..."
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !selectedPhone}
              className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200 disabled:opacity-50"
            >
              Enviar mensagem
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
