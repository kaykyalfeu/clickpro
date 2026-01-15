"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function DashboardHeader() {
  const { data: session } = useSession();
  const user = session?.user;

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <header className="border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-violet-500/30">
              CP
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ClickPro</h1>
              <p className="text-xs text-slate-400">Dashboard</p>
            </div>
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
            </div>
          )}

          <nav className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Home
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
