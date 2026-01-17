"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      router.push("/dashboard?error=access_denied");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Carregando...</div>
      </div>
    );
  }

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return null;
  }

  const navItems = [
    { href: "/admin", label: "Visao Geral", exact: true },
    { href: "/admin/clients", label: "Clientes" },
    { href: "/admin/users", label: "Usuarios" },
    { href: "/admin/licenses", label: "Licencas" },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Admin Header */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-lg font-bold text-white">
                CP
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ClickPro</h1>
                <p className="text-xs text-amber-400">Admin Panel</p>
              </div>
            </Link>
          </div>

          <nav className="flex items-center gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                  isActive(item.href, item.exact)
                    ? "bg-violet-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              className="text-sm px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              Voltar ao Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
