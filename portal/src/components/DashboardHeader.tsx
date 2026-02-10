"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LicenseStatus from "./LicenseStatus";
import Brand from "./Brand";

export default function DashboardHeader() {
  const { data: session } = useSession();
  const user = session?.user;
  const pathname = usePathname();

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <header className="border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity"
          >
            <Brand size="md" subtitle="Dashboard" titleClassName="text-white" subtitleClassName="text-slate-400" />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-slate-400">
                  {user.role === "SUPER_ADMIN" && "Super Admin"}
                  {user.role === "CLIENT_ADMIN" && `Admin - ${user.clientName || "Cliente"}`}
                  {user.role === "CLIENT_USER" && `Usuário - ${user.clientName || "Cliente"}`}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-violet-600/30 flex items-center justify-center text-violet-300 text-sm font-medium border border-violet-500/30">
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <LicenseStatus />
            </div>
          )}


          <nav className="flex items-center gap-3">
            {user?.role === "SUPER_ADMIN" && (
              <Link
                href="/admin"
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  pathname === "/admin" || pathname.startsWith("/admin/")
                    ? "bg-amber-500/30 text-amber-200 border-amber-400/60"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30"
                }`}
              >
                Admin
              </Link>
            )}
            <Link
              href="/"
              className={`text-sm transition-colors ${
                pathname === "/"
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Home
            </Link>
            <Link
              href="/conversations"
              className={`text-sm transition-colors ${
                pathname === "/conversations" || pathname.startsWith("/conversations/")
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Inbox
            </Link>
            <Link
              href="/credentials"
              className={`text-sm transition-colors ${
                pathname === "/credentials" || pathname.startsWith("/credentials/")
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Credenciais
            </Link>
            <Link
              href="/templates"
              className={`text-sm transition-colors ${
                pathname === "/templates" || pathname.startsWith("/templates/")
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Templates
            </Link>
            <Link
              href="/campaigns"
              className={`text-sm transition-colors ${
                pathname === "/campaigns" || pathname.startsWith("/campaigns/")
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Campanhas
            </Link>
            <Link
              href="/contacts"
              className={`text-sm transition-colors ${
                pathname === "/contacts" || pathname.startsWith("/contacts/")
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Contatos
            </Link>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
            >
              Sair
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
