"use client";

import { useEffect, useMemo, useState } from "react";
import ApiConfigCard from "@/components/ApiConfigCard";
import DashboardHeader from "@/components/DashboardHeader";
import { formatActivationError } from "@/lib/license.client";

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

const defaultBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://clickpro.grupogarciaseguradoras.com.br";

export default function ConversationsPage() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);
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
      <DashboardHeader />

      <div className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold" title="Central de atendimento manual para responder seus clientes">Inbox de Conversas</h1>
            <p className="text-sm text-slate-400" title="Visualize e responda mensagens recebidas manualmente">
              Acompanhe mensagens, filtre histórico e responda manualmente. Use essa tela para acompanhar clientes em tempo real.
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

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-lg font-semibold mb-4" title="Lista de todas as conversas com seus contatos">Conversas</h2>
          <div className="mb-4">
            <label className="text-xs text-slate-400" title="Filtre conversas por nome ou número">Buscar contato</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou telefone"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              title="Digite para filtrar conversas"
            />
          </div>
          {loading && (
            <p className="text-xs text-slate-500" title="Buscando conversas do servidor">Carregando conversas...</p>
          )}
          <div className="space-y-3">
            {conversations.length === 0 && !loading && (
              <p className="text-sm text-slate-400" title="Nenhuma conversa encontrada">Nenhuma conversa encontrada. As conversas aparecerão aqui quando você receber mensagens.</p>
            )}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedPhone(conversation.phone)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selectedPhone === conversation.phone
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-slate-800 bg-slate-950 hover:border-slate-700"
                }`}
                title={`Clique para ver mensagens de ${conversation.name || conversation.phone}`}
              >
                <p className="text-sm font-semibold" title="Nome ou número do contato">
                  {conversation.name || conversation.phone}
                </p>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2" title="Última mensagem da conversa">
                  {conversation.last_message || "Sem mensagens ainda"}
                </p>
                <p className="mt-2 text-[11px] text-slate-500" title="Data da última mensagem">
                  {conversation.last_at ? new Date(conversation.last_at).toLocaleString() : ""}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold" title="Histórico completo de mensagens com o contato selecionado">Histórico</h2>
              <p className="text-xs text-slate-400" title={selectedPhone ? `Visualizando mensagens do número ${selectedPhone}` : "Clique em uma conversa ao lado"}>
                {selectedPhone ? `Contato: ${selectedPhone}` : "Selecione um contato"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-300">
              <select
                value={directionFilter}
                onChange={(event) => setDirectionFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                title="Filtrar por direção da mensagem"
              >
                <option value="all" title="Mostrar todas as mensagens">Direção</option>
                <option value="INBOUND" title="Mensagens recebidas do cliente">Inbound</option>
                <option value="OUTBOUND" title="Mensagens enviadas por você">Outbound</option>
                <option value="STATUS" title="Notificações de status">Status</option>
              </select>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                title="Filtrar por origem da mensagem"
              >
                <option value="all" title="Mostrar todas as fontes">Fonte</option>
                <option value="AI" title="Mensagens respondidas pela IA">IA</option>
                <option value="HUMAN" title="Mensagens enviadas manualmente">Humano</option>
                <option value="AGENT" title="Mensagens de agentes">Agente</option>
                <option value="WEBHOOK" title="Mensagens via integração">Webhook</option>
                <option value="CAMPAIGN" title="Mensagens de campanhas">Campanha</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                title="Filtrar por status de entrega"
              >
                <option value="all" title="Mostrar todos os status">Status</option>
                <option value="RECEIVED" title="Mensagem recebida pelo servidor">Received</option>
                <option value="QUEUED" title="Mensagem na fila de envio">Queued</option>
                <option value="SENT" title="Mensagem enviada com sucesso">Sent</option>
                <option value="READ" title="Mensagem lida pelo destinatário">Read</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="mt-6 max-h-[420px] space-y-3 overflow-y-auto pr-2">
            {!selectedPhone && (
              <p className="text-sm text-slate-400 text-center py-8" title="Selecione uma conversa para ver as mensagens">
                👈 Selecione uma conversa ao lado para ver as mensagens
              </p>
            )}
            {selectedPhone && filteredMessages.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8" title="Nenhuma mensagem encontrada com os filtros atuais">
                Nenhuma mensagem encontrada com os filtros selecionados
              </p>
            )}
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border px-4 py-3 ${
                  message.direction === "OUTBOUND"
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-slate-800 bg-slate-950"
                }`}
                title={message.direction === "OUTBOUND" ? "Mensagem enviada" : "Mensagem recebida"}
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span title={message.direction === "OUTBOUND" ? "Mensagem enviada por você" : message.direction === "INBOUND" ? "Mensagem recebida do cliente" : "Notificação de status"}>
                    {message.direction === "OUTBOUND" ? "📤 Enviada" : message.direction === "INBOUND" ? "📥 Recebida" : "📋 Status"}
                  </span>
                  <span title="Data e hora da mensagem">{new Date(message.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm text-slate-100" title="Conteúdo da mensagem">{message.content}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  <span className="rounded-full bg-slate-800 px-2 py-1" title={`Origem: ${message.source === "AI" ? "Inteligência Artificial" : message.source === "HUMAN" ? "Atendente humano" : message.source}`}>
                    {message.source === "AI" ? "🤖 IA" : message.source === "HUMAN" ? "👤 Humano" : message.source}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-1" title={`Status: ${message.status === "SENT" ? "Enviada" : message.status === "READ" ? "Lida" : message.status === "RECEIVED" ? "Recebida" : message.status}`}>
                    {message.status === "SENT" ? "✓ Enviada" : message.status === "READ" ? "✓✓ Lida" : message.status === "RECEIVED" ? "📩 Recebida" : message.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <label className="text-xs text-slate-400" title="Digite uma mensagem para enviar manualmente ao cliente">Nova mensagem</label>
            <textarea
              value={outboundMessage}
              onChange={(event) => setOutboundMessage(event.target.value)}
              className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Escreva uma mensagem manual..."
              title="Digite aqui a mensagem que deseja enviar ao cliente"
              disabled={!selectedPhone}
            />
            {!selectedPhone && (
              <p className="mt-1 text-xs text-amber-400" title="Selecione um contato primeiro">⚠️ Selecione uma conversa para enviar mensagens</p>
            )}
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !selectedPhone || !outboundMessage.trim()}
              className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!selectedPhone ? "Selecione um contato primeiro" : !outboundMessage.trim() ? "Digite uma mensagem" : "Clique para enviar a mensagem"}
            >
              Enviar mensagem
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
