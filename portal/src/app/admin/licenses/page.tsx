"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface LicenseClient {
  id: string;
  name: string;
  slug: string;
}

interface License {
  id: string;
  token: string;
  plan: string;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
  client: LicenseClient;
  validationCount: number;
}

interface Client {
  id: string;
  name: string;
  slug: string;
}

export default function AdminLicensesPage() {
  const searchParams = useSearchParams();
  const showCreate = searchParams.get("action") === "create";

  const [licenses, setLicenses] = useState<License[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(showCreate);
  const [formClientId, setFormClientId] = useState("");
  const [formPlan, setFormPlan] = useState("standard");
  const [formDays, setFormDays] = useState(365);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);

  async function fetchLicenses() {
    try {
      const res = await fetch(`/api/admin/licenses?status=${filter}`);
      const data = await res.json();
      if (data.ok) {
        setLicenses(data.licenses);
      } else {
        setError(data.error || "Erro ao carregar licencas");
      }
    } catch {
      setError("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  async function fetchClients() {
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (data.ok) {
        setClients(data.clients);
      }
    } catch {
      // Silent fail
    }
  }

  useEffect(() => {
    fetchLicenses();
    fetchClients();
  }, [filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);
    setNewToken(null);

    try {
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: formClientId,
          plan: formPlan,
          expiresInDays: formDays,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setFormSuccess("Licenca criada com sucesso!");
        setNewToken(data.license.token);
        fetchLicenses();
      } else {
        setFormError(data.error || "Erro ao criar licenca");
      }
    } catch {
      setFormError("Erro de conexao");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleRevoke(license: License) {
    if (!confirm(`Revogar licenca ${license.token}? A licenca sera invalidada imediatamente.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoke: true }),
      });

      const data = await res.json();

      if (data.ok) {
        fetchLicenses();
      } else {
        alert(data.error || "Erro ao revogar licenca");
      }
    } catch {
      alert("Erro de conexao");
    }
  }

  async function handleExtend(license: License) {
    const days = prompt("Quantos dias deseja estender?", "30");
    if (!days || isNaN(Number(days))) return;

    try {
      const res = await fetch(`/api/admin/licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extendDays: Number(days) }),
      });

      const data = await res.json();

      if (data.ok) {
        fetchLicenses();
        alert(`Licenca estendida ate ${new Date(data.license.expiresAt).toLocaleDateString("pt-BR")}`);
      } else {
        alert(data.error || "Erro ao estender licenca");
      }
    } catch {
      alert("Erro de conexao");
    }
  }

  function copyToken(token: string, id: string) {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Licencas</h2>
          <p className="text-slate-400 mt-1">
            Gerencie as licencas do sistema
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setNewToken(null);
            setFormSuccess(null);
          }}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Nova Licenca"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Nova Licenca</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Cliente *
                </label>
                <select
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Plano
                </label>
                <select
                  value={formPlan}
                  onChange={(e) => setFormPlan(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="trial">Trial</option>
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Validade (dias)
                </label>
                <input
                  type="number"
                  value={formDays}
                  onChange={(e) => setFormDays(Number(e.target.value))}
                  min={1}
                  max={3650}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-sm">
                {formSuccess}
              </div>
            )}

            {newToken && (
              <div className="p-4 rounded-lg bg-amber-500/20 border border-amber-500/50">
                <p className="text-amber-300 text-sm font-medium mb-2">
                  Token da licenca:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded bg-slate-900 text-white font-mono">
                    {newToken}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToken(newToken, "new")}
                    className="px-3 py-2 rounded bg-slate-700 text-white text-sm hover:bg-slate-600"
                  >
                    {copiedId === "new" ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={formLoading || !formClientId}
              className="px-6 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {formLoading ? "Criando..." : "Criar Licenca"}
            </button>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6 flex gap-2">
        {(["all", "active", "expired"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-violet-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {f === "all" ? "Todas" : f === "active" ? "Ativas" : "Expiradas"}
          </button>
        ))}
      </div>

      {/* Licenses List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">{error}</div>
      ) : licenses.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          Nenhuma licenca encontrada
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Token
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Cliente
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Plano
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Validade
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Validacoes
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr
                  key={license.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/20"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="text-slate-300 font-mono text-sm">
                        {license.token}
                      </code>
                      <button
                        onClick={() => copyToken(license.token, license.id)}
                        className="text-xs text-violet-400 hover:text-violet-300"
                      >
                        {copiedId === license.id ? "OK" : "Copiar"}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-white">
                    {license.client.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300">
                      {license.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className={license.isActive ? "text-white" : "text-red-400"}>
                        {new Date(license.expiresAt).toLocaleDateString("pt-BR")}
                      </p>
                      {license.isActive ? (
                        <span className="text-xs text-emerald-400">Ativa</span>
                      ) : (
                        <span className="text-xs text-red-400">Expirada</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {license.validationCount}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {license.isActive && (
                        <>
                          <button
                            onClick={() => handleExtend(license)}
                            className="text-sm text-emerald-400 hover:text-emerald-300"
                          >
                            Estender
                          </button>
                          <button
                            onClick={() => handleRevoke(license)}
                            className="text-sm text-red-400 hover:text-red-300"
                          >
                            Revogar
                          </button>
                        </>
                      )}
                      {!license.isActive && (
                        <button
                          onClick={() => handleExtend(license)}
                          className="text-sm text-emerald-400 hover:text-emerald-300"
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
