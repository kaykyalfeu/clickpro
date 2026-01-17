"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface UserClient {
  id: string;
  name: string;
  slug: string;
  memberRole: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  clients: UserClient[];
}

interface Client {
  id: string;
  name: string;
  slug: string;
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const showCreate = searchParams.get("action") === "create";

  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(showCreate);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("CLIENT_USER");
  const [formClientId, setFormClientId] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users);
      } else {
        setError(data.error || "Erro ao carregar usuarios");
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
      // Silent fail for clients
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);
    setTempPassword(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formEmail,
          name: formName || undefined,
          role: formRole,
          clientId: formRole !== "SUPER_ADMIN" ? formClientId : undefined,
          generatePassword: true,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setFormSuccess(`Usuario "${data.user.email}" criado com sucesso!`);
        if (data.temporaryPassword) {
          setTempPassword(data.temporaryPassword);
        }
        setFormEmail("");
        setFormName("");
        setFormClientId("");
        fetchUsers();
      } else {
        setFormError(data.error || "Erro ao criar usuario");
      }
    } catch {
      setFormError("Erro de conexao");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleResetPassword(user: User) {
    if (!confirm(`Gerar nova senha para ${user.email}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });

      const data = await res.json();

      if (data.ok && data.temporaryPassword) {
        alert(`Nova senha temporaria: ${data.temporaryPassword}\n\nAnote esta senha - ela nao sera exibida novamente.`);
      } else {
        alert(data.error || "Erro ao resetar senha");
      }
    } catch {
      alert("Erro de conexao");
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Tem certeza que deseja excluir o usuario "${user.email}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.ok) {
        fetchUsers();
      } else {
        alert(data.error || "Erro ao excluir usuario");
      }
    } catch {
      alert("Erro de conexao");
    }
  }

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    CLIENT_ADMIN: "Admin Cliente",
    CLIENT_USER: "Usuario",
  };

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-amber-400/20 text-amber-300 border-amber-400/30",
    CLIENT_ADMIN: "bg-violet-400/20 text-violet-300 border-violet-400/30",
    CLIENT_USER: "bg-slate-400/20 text-slate-300 border-slate-400/30",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Usuarios</h2>
          <p className="text-slate-400 mt-1">
            Gerencie os usuarios cadastrados no sistema
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setTempPassword(null);
            setFormSuccess(null);
          }}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Novo Usuario"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Novo Usuario</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  required
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome completo (opcional)"
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Perfil *
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="CLIENT_USER">Usuario</option>
                  <option value="CLIENT_ADMIN">Admin Cliente</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              {formRole !== "SUPER_ADMIN" && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Cliente *
                  </label>
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    required={formRole !== "SUPER_ADMIN"}
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
              )}
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

            {tempPassword && (
              <div className="p-4 rounded-lg bg-amber-500/20 border border-amber-500/50">
                <p className="text-amber-300 text-sm font-medium mb-2">
                  Senha temporaria gerada:
                </p>
                <code className="block px-3 py-2 rounded bg-slate-900 text-white font-mono">
                  {tempPassword}
                </code>
                <p className="text-amber-300/70 text-xs mt-2">
                  Anote esta senha - ela nao sera exibida novamente.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={formLoading || !formEmail.trim() || (formRole !== "SUPER_ADMIN" && !formClientId)}
              className="px-6 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {formLoading ? "Criando..." : "Criar Usuario"}
            </button>
          </form>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">{error}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          Nenhum usuario cadastrado
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Usuario
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Perfil
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Cliente(s)
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Criado em
                </th>
                <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/20"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">
                        {user.name || user.email}
                      </p>
                      {user.name && (
                        <p className="text-slate-400 text-sm">{user.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${
                        roleColors[user.role] || roleColors.CLIENT_USER
                      }`}
                    >
                      {roleLabels[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {user.clients.length > 0
                      ? user.clients.map((c) => c.name).join(", ")
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResetPassword(user)}
                        className="text-sm text-amber-400 hover:text-amber-300"
                      >
                        Reset senha
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
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
