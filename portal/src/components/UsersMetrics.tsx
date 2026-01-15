"use client";

interface UserMetric {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive" | "pending";
  installs: number;
  lastActivity: string;
}

export default function UsersMetrics() {
  // Placeholder data - TODO: fetch from API/database
  const users: UserMetric[] = [
    {
      id: "1",
      name: "João Silva",
      email: "joao@empresa.com",
      status: "active",
      installs: 3,
      lastActivity: "2025-01-15T10:30:00Z",
    },
    {
      id: "2",
      name: "Maria Santos",
      email: "maria@tech.com",
      status: "active",
      installs: 5,
      lastActivity: "2025-01-14T18:45:00Z",
    },
    {
      id: "3",
      name: "Pedro Oliveira",
      email: "pedro@startup.io",
      status: "pending",
      installs: 1,
      lastActivity: "2025-01-13T09:15:00Z",
    },
    {
      id: "4",
      name: "Ana Costa",
      email: "ana@corp.com",
      status: "inactive",
      installs: 2,
      lastActivity: "2024-12-20T14:00:00Z",
    },
    {
      id: "5",
      name: "Carlos Mendes",
      email: "carlos@digital.com",
      status: "active",
      installs: 8,
      lastActivity: "2025-01-15T08:20:00Z",
    },
  ];

  const statusColors = {
    active: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
    inactive: "bg-slate-400/20 text-slate-300 border-slate-400/30",
    pending: "bg-amber-400/20 text-amber-300 border-amber-400/30",
  };

  const statusLabels = {
    active: "Ativo",
    inactive: "Inativo",
    pending: "Pendente",
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Métricas de Usuários</h3>
        <span className="text-sm text-slate-400">{users.length} usuários</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-sm font-medium text-slate-400 pb-3">
                Usuário
              </th>
              <th className="text-left text-sm font-medium text-slate-400 pb-3">
                Status
              </th>
              <th className="text-left text-sm font-medium text-slate-400 pb-3">
                Instalações
              </th>
              <th className="text-left text-sm font-medium text-slate-400 pb-3">
                Última Atividade
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-slate-700/50 hover:bg-slate-700/20"
              >
                <td className="py-3">
                  <div>
                    <p className="text-white font-medium">{user.name}</p>
                    <p className="text-slate-400 text-sm">{user.email}</p>
                  </div>
                </td>
                <td className="py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${
                      statusColors[user.status]
                    }`}
                  >
                    {statusLabels[user.status]}
                  </span>
                </td>
                <td className="py-3 text-slate-300">{user.installs}</td>
                <td className="py-3 text-slate-400 text-sm">
                  {formatDate(user.lastActivity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        * Dados de demonstração. Conecte ao banco de dados para dados reais.
      </p>
    </div>
  );
}
