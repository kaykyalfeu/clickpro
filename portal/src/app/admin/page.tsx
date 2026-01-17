import { prisma } from "@/lib/prisma";
import Link from "next/link";

async function getAdminStats() {
  const [
    totalClients,
    totalUsers,
    totalLicenses,
    activeLicenses,
    recentValidations,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.user.count(),
    prisma.license.count(),
    prisma.license.count({
      where: {
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.licenseValidationLog.count({
      where: {
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    totalClients,
    totalUsers,
    totalLicenses,
    activeLicenses,
    recentValidations,
  };
}

export default async function AdminPage() {
  const stats = await getAdminStats();

  const cards = [
    {
      title: "Clientes",
      value: stats.totalClients,
      href: "/admin/clients",
      color: "violet",
    },
    {
      title: "Usuarios",
      value: stats.totalUsers,
      href: "/admin/users",
      color: "blue",
    },
    {
      title: "Licencas Ativas",
      value: stats.activeLicenses,
      subtitle: `de ${stats.totalLicenses} total`,
      href: "/admin/licenses",
      color: "emerald",
    },
    {
      title: "Validacoes (24h)",
      value: stats.recentValidations,
      href: "/admin/licenses",
      color: "amber",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Painel Administrativo</h2>
        <p className="text-slate-400 mt-1">
          Gerencie clientes, usuarios e licencas do sistema
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:bg-slate-800 transition-colors"
          >
            <p className="text-slate-400 text-sm font-medium">{card.title}</p>
            <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
            {card.subtitle && (
              <p className="text-sm text-slate-500 mt-1">{card.subtitle}</p>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Acoes Rapidas</h3>
          <div className="space-y-3">
            <Link
              href="/admin/clients?action=create"
              className="block w-full text-left px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white hover:bg-slate-800 transition-colors"
            >
              + Criar novo cliente
            </Link>
            <Link
              href="/admin/users?action=create"
              className="block w-full text-left px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white hover:bg-slate-800 transition-colors"
            >
              + Criar novo usuario
            </Link>
            <Link
              href="/admin/licenses?action=create"
              className="block w-full text-left px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white hover:bg-slate-800 transition-colors"
            >
              + Gerar nova licenca
            </Link>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Status do Sistema</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-700">
              <span className="text-slate-300">Banco de Dados</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                Online
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-700">
              <span className="text-slate-300">Autenticacao</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                Ativo
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-700">
              <span className="text-slate-300">Rate Limiting</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                Ativo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
