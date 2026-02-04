"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import LicenseStatus from "./LicenseStatus";
import ThemeToggle from "./ThemeToggle";

export default function DashboardHeader() {
  const { data: session } = useSession();
  const user = session?.user;

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <header
      className="border-b"
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg overflow-hidden"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-contrast)",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
              }}
            >
              <Image
                src="/logo.png"
                alt="ClickPro Logo"
                width={40}
                height={40}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.removeAttribute("style");
                }}
              />
              <span style={{ display: "none" }}>CP</span>
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                ClickPro
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Dashboard
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {user.name || user.email}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {user.role === "SUPER_ADMIN" && "Super Admin"}
                  {user.role === "CLIENT_ADMIN" && `Admin - ${user.clientName || "Cliente"}`}
                  {user.role === "CLIENT_USER" && `Usuário - ${user.clientName || "Cliente"}`}
                </p>
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border"
                style={{
                  backgroundColor: "rgba(124, 58, 237, 0.2)",
                  color: "var(--primary)",
                  borderColor: "rgba(124, 58, 237, 0.3)",
                }}
              >
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <LicenseStatus />
            </div>
          )}

          <nav className="flex items-center gap-3">
            {user?.role === "SUPER_ADMIN" && (
              <Link
                href="/admin"
                className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                style={{
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  color: "#F59E0B",
                  borderColor: "rgba(245, 158, 11, 0.3)",
                }}
              >
                Admin
              </Link>
            )}
            <Link
              href="/"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Home
            </Link>
            <Link
              href="/conversations"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Inbox
            </Link>
            <Link
              href="/credentials"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Credenciais
            </Link>
            <Link
              href="/templates"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Templates
            </Link>
            <Link
              href="/campaigns"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Campanhas
            </Link>
            <Link
              href="/contacts"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Contatos
            </Link>
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--text-muted)",
              }}
            >
              Sair
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
