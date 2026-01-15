import KpiCards from "@/components/KpiCards";
import LicenseGenerator from "@/components/LicenseGenerator";
import LicenseValidator from "@/components/LicenseValidator";
import UsersMetrics from "@/components/UsersMetrics";
import DashboardHeader from "@/components/DashboardHeader";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Header */}
      <DashboardHeader />

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
