import Link from "next/link";
import KpiCards from "@/components/KpiCards";
import LicenseGenerator from "@/components/LicenseGenerator";
import LicenseValidator from "@/components/LicenseValidator";
import UsersMetrics from "@/components/UsersMetrics";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-violet-500/30">
                CP
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ClickPro</h1>
                <p className="text-xs text-slate-400">Dashboard</p>
              </div>
            </Link>
          </div>

          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Home
            </Link>
            <button className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors">
              Sair
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-slate-400 mt-1">
            Visão geral do sistema de licenciamento
          </p>
        </div>

        {/* KPI Cards */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">
            Métricas Principais
          </h3>
          <KpiCards />
        </section>

        {/* License Tools */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">
            Ferramentas de Licença
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LicenseGenerator />
            <LicenseValidator />
          </div>
        </section>

        {/* Users Metrics */}
        <section className="mb-8">
          <UsersMetrics />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-sm text-slate-500 text-center">
            &copy; {new Date().getFullYear()} ClickPro Portal. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
