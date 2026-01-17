"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

function KpiCard({ title, value, subtitle, trend, loading }: KpiCardProps) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-slate-400",
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
      <p className="text-slate-400 text-sm font-medium">{title}</p>
      {loading ? (
        <div className="h-9 mt-2 bg-slate-700/50 rounded animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-white mt-2">{value}</p>
      )}
      {subtitle && !loading && (
        <p className={`text-sm mt-1 ${trend ? trendColors[trend] : "text-slate-500"}`}>
          {trend === "up" && "↑ "}
          {trend === "down" && "↓ "}
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface AdminMetrics {
  clients: { total: number };
  users: { total: number; createdLast7d: number; createdLast30d: number };
  licenses: { total: number; active: number; expiringSoon: number };
  validations: { last24h: number; successful: number; failed: number; successRate: number };
}

interface ClientMetrics {
  members: number;
  licenses: { active: number; plan: string | null; expiresAt: string | null; daysRemaining: number };
  validations: { last24h: number; successful: number };
}

export default function KpiCards() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics | ClientMetrics | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/dashboard/metrics");
        const data = await res.json();
        if (data.ok) {
          setMetrics(data.metrics);
          setRole(data.role);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  // SUPER_ADMIN KPIs
  if (role === "SUPER_ADMIN" && metrics) {
    const m = metrics as AdminMetrics;
    const kpis: KpiCardProps[] = [
      {
        title: "Clientes Cadastrados",
        value: m.clients.total,
        trend: "neutral",
      },
      {
        title: "Usuarios Totais",
        value: m.users.total,
        subtitle: `+${m.users.createdLast7d} nos ultimos 7 dias`,
        trend: m.users.createdLast7d > 0 ? "up" : "neutral",
      },
      {
        title: "Licencas Ativas",
        value: m.licenses.active,
        subtitle: `de ${m.licenses.total} total`,
        trend: "neutral",
      },
      {
        title: "Expirando em 30 dias",
        value: m.licenses.expiringSoon,
        trend: m.licenses.expiringSoon > 0 ? "down" : "neutral",
      },
      {
        title: "Validacoes (24h)",
        value: m.validations.last24h,
        subtitle: `${m.validations.successRate}% sucesso`,
        trend: m.validations.successRate >= 90 ? "up" : "down",
      },
      {
        title: "Falhas de Validacao",
        value: m.validations.failed,
        subtitle: "ultimas 24h",
        trend: m.validations.failed > 0 ? "down" : "up",
      },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, index) => (
          <KpiCard key={index} {...kpi} loading={loading} />
        ))}
      </div>
    );
  }

  // CLIENT_ADMIN/CLIENT_USER KPIs
  if (metrics) {
    const m = metrics as ClientMetrics;
    const kpis: KpiCardProps[] = [
      {
        title: "Membros da Equipe",
        value: m.members,
        trend: "neutral",
      },
      {
        title: "Licencas Ativas",
        value: m.licenses.active,
        subtitle: m.licenses.plan ? `Plano: ${m.licenses.plan}` : undefined,
        trend: m.licenses.active > 0 ? "up" : "down",
      },
      {
        title: "Dias Restantes",
        value: m.licenses.daysRemaining,
        subtitle: m.licenses.expiresAt
          ? `Expira em ${new Date(m.licenses.expiresAt).toLocaleDateString("pt-BR")}`
          : "Sem licenca ativa",
        trend: m.licenses.daysRemaining > 30 ? "up" : m.licenses.daysRemaining > 0 ? "neutral" : "down",
      },
      {
        title: "Validacoes (24h)",
        value: m.validations.last24h,
        subtitle: `${m.validations.successful} com sucesso`,
        trend: "neutral",
      },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KpiCard key={index} {...kpi} loading={loading} />
        ))}
      </div>
    );
  }

  // Loading state
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, index) => (
        <KpiCard key={index} title="Carregando..." value="-" loading={true} />
      ))}
    </div>
  );
}
