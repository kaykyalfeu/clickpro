"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface GeneratedLicense {
  licenseKey: string;
  expiresAt: string;
  issuedAt: string;
}

interface Client {
  id: string;
  name: string;
  slug: string;
}

export default function LicenseGenerator() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(365);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedLicense | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Client selector state for SUPER_ADMIN
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);

  // Fetch clients when SUPER_ADMIN
  useEffect(() => {
    if (isSuperAdmin) {
      setLoadingClients(true);
      fetch("/api/admin/clients")
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) {
            setClients(data.clients);
          }
        })
        .catch(() => {
          // Silent fail
        })
        .finally(() => setLoadingClients(false));
    }
  }, [isSuperAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/license/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: isSuperAdmin ? selectedClientId : undefined,
          customerName: customerName || undefined,
          email: email || undefined,
          expiresInDays,
          notes: notes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Falha ao gerar licença");
      }

      setResult({
        licenseKey: data.licenseKey,
        expiresAt: data.expiresAt,
        issuedAt: data.issuedAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.licenseKey) {
      navigator.clipboard.writeText(result.licenseKey);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Gerar Nova Licença</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Client selector for SUPER_ADMIN */}
        {isSuperAdmin && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Cliente *
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              required
              disabled={loadingClients}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
            >
              <option value="">
                {loadingClients ? "Carregando..." : "Selecione um cliente"}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Nome do Cliente (opcional)
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex: Empresa ABC"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Email (opcional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@empresa.com"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Validade (dias)
            </label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              min={1}
              max={3650}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Notas (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações internas"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || (isSuperAdmin && !selectedClientId)}
          className="px-6 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Gerando..." : "Gerar Licença"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 rounded-lg bg-emerald-500/20 border border-emerald-500/50">
          <p className="text-emerald-300 text-sm font-medium mb-2">
            Licença gerada com sucesso!
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded bg-slate-900 text-slate-200 text-sm font-mono overflow-x-auto">
              {result.licenseKey}
            </code>
            <button
              onClick={copyToClipboard}
              className="px-3 py-2 rounded bg-slate-700 text-white text-sm hover:bg-slate-600 transition-colors"
            >
              Copiar
            </button>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            Expira em: {new Date(result.expiresAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}
