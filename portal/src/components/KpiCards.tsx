"use client";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
}

function KpiCard({ title, value, subtitle, trend }: KpiCardProps) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-slate-400",
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
      <p className="text-slate-400 text-sm font-medium">{title}</p>
      <p className="text-3xl font-bold text-white mt-2">{value}</p>
      {subtitle && (
        <p className={`text-sm mt-1 ${trend ? trendColors[trend] : "text-slate-500"}`}>
          {trend === "up" && "↑ "}
          {trend === "down" && "↓ "}
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default function KpiCards() {
  const kpis: KpiCardProps[] = [
    {
      title: "Licenças Ativas",
      value: 247,
      subtitle: "+12% este mês",
      trend: "up",
    },
    {
      title: "Usuários Totais",
      value: 1842,
      subtitle: "+8% este mês",
      trend: "up",
    },
    {
      title: "Taxa de Renovação",
      value: "94%",
      subtitle: "+2% vs. anterior",
      trend: "up",
    },
    {
      title: "Licenças Expirando",
      value: 23,
      subtitle: "Próximos 30 dias",
      trend: "neutral",
    },
    {
      title: "Receita Mensal",
      value: "R$ 45.2K",
      subtitle: "+15% este mês",
      trend: "up",
    },
    {
      title: "Tickets Abertos",
      value: 8,
      subtitle: "-3 vs. semana passada",
      trend: "down",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi, index) => (
        <KpiCard key={index} {...kpi} />
      ))}
    </div>
  );
}
