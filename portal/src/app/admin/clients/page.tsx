"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Client {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  licenseCount: number;
  hasActiveLicense: boolean;
  licenseExpiresAt: string | null;
}

export default function AdminClientsPage() {
  const searchParams = useSearchParams();
  const showCreate = searchParams.get("action") === "create";

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(showCreate);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function fetchClients() {
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (data.ok) {
        setClients(data.clients);
      } else {
        setError(data.error || "Erro ao carregar clientes");
      }
    } catch {
      setError("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          slug: formSlug || undefined,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setFormSuccess(`Cliente "${data.client.name}" criado com sucesso!`);
        setFormName("");
        setFormSlug("");
        fetchClients();
        setTimeout(() => {
          setShowForm(false);
          setFormSuccess(null);
        }, 2000);
      } else {
        setFormError(data.error || "Erro ao criar cliente");
      }
    } catch {
      setFormError("Erro de conexao");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${client.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.ok) {
        fetchClients();
      } else {
        alert(data.error || "Erro ao excluir cliente");
      }
    } catch {
      alert("Erro de conexao");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Clientes</h2>
          <p className="text-slate-400 mt-1">
            Gerencie os clientes cadastrados no sistema
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Novo Cliente"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Novo Cliente</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Empresa ABC"
                  required
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Identificador (slug)
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="empresa-abc (opcional, gerado automaticamente)"
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
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

            <button
              type="submit"
              disabled={formLoading || !formName.trim()}
              className="px-6 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {formLoading ? "Criando..." : "Criar Cliente"}
            </button>
          </form>
        </div>
      )}

      {/* Clients List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">{error}</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          Nenhum cliente cadastrado
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Cliente
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Membros
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Licencas
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Status
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/20"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">{client.name}</p>
                      <p className="text-slate-400 text-sm">{client.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {client.memberCount}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {client.licenseCount}
                  </td>
                  <td className="px-6 py-4">
                    {client.hasActiveLicense ? (
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        Sem licenca ativa
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/admin/clients/${client.id}`}
                        className="text-sm text-violet-400 hover:text-violet-300"
                      >
                        Detalhes
                      </a>
                      <button
                        onClick={() => handleDelete(client)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Excluir
                      </button>
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
