"use client";

import { useEffect, useState } from "react";

interface RecentUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  clientName: string | null;
}

export default function UsersMetrics() {
  const [users, setUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/dashboard/metrics");
        const data = await res.json();
        if (data.ok) {
          setRole(data.role);
          if (data.recentUsers) {
            setUsers(data.recentUsers);
          }
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  // Only show for SUPER_ADMIN
  if (role !== "SUPER_ADMIN") {
    return null;
  }

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    CLIENT_ADMIN: "Admin",
    CLIENT_USER: "Usuario",
  };

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-amber-400/20 text-amber-300 border-amber-400/30",
    CLIENT_ADMIN: "bg-violet-400/20 text-violet-300 border-violet-400/30",
    CLIENT_USER: "bg-slate-400/20 text-slate-300 border-slate-400/30",
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
        <h3 className="text-lg font-semibold text-white">Usuarios Recentes</h3>
        <span className="text-sm text-slate-400">{users.length} usuarios</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-700/50 rounded animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-slate-400 text-center py-8">Nenhum usuario encontrado</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-sm font-medium text-slate-400 pb-3">
                  Usuario
                </th>
                <th className="text-left text-sm font-medium text-slate-400 pb-3">
                  Perfil
                </th>
                <th className="text-left text-sm font-medium text-slate-400 pb-3">
                  Cliente
                </th>
                <th className="text-left text-sm font-medium text-slate-400 pb-3">
                  Criado em
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
                      <p className="text-white font-medium">{user.name || "-"}</p>
                      <p className="text-slate-400 text-sm">{user.email}</p>
                    </div>
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${
                        roleColors[user.role] || roleColors.CLIENT_USER
                      }`}
                    >
                      {roleLabels[user.role] || user.role}
                    </span>
                  </td>
                  <td className="py-3 text-slate-300">
                    {user.clientName || "-"}
                  </td>
                  <td className="py-3 text-slate-400 text-sm">
                    {formatDate(user.createdAt)}
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
