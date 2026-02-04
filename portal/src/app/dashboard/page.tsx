"use client";

import { useSession } from "next-auth/react";
import KpiCards from "@/components/KpiCards";
import LicenseGenerator from "@/components/LicenseGenerator";
import LicenseValidator from "@/components/LicenseValidator";
import UsersMetrics from "@/components/UsersMetrics";
import DashboardHeader from "@/components/DashboardHeader";

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isClientAdmin = role === "CLIENT_ADMIN";
  const isAdmin = isSuperAdmin || isClientAdmin;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(to bottom, var(--bg), var(--bg-elevated))" }}>
      {/* Header */}
      <DashboardHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            Dashboard
          </h2>
          <p className="mt-1" style={{ color: "var(--text-muted)" }}>
            {isSuperAdmin
              ? "Visão geral do sistema de licenciamento"
              : "Visão geral da sua conta"}
          </p>
        </div>

        {/* KPI Cards */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text)" }}>
            Métricas Principais
          </h3>
          <KpiCards />
        </section>

        {/* License Tools - Only for SUPER_ADMIN and CLIENT_ADMIN */}
        {isAdmin && (
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text)" }}>
              Ferramentas de Licença
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LicenseGenerator />
              <LicenseValidator />
            </div>
          </section>
        )}

        {/* Users Metrics - Only for SUPER_ADMIN */}
        <section className="mb-8">
          <UsersMetrics />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
            &copy; {new Date().getFullYear()} ClickPro Portal. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
