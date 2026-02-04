"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-violet-500/30">
              CP
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">ClickPro</h1>
              <p className="text-sm text-slate-400">Portal de Licenciamento</p>
            </div>
          </Link>
        </div>

        <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 shadow-xl">
          {!submitted ? (
            <>
              <h2 className="text-xl font-semibold text-white text-center mb-2">
                Recuperar Senha
              </h2>
              <p className="text-sm text-slate-400 text-center mb-6">
                Digite seu email para receber instruções de recuperação.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/30"
                >
                  {loading ? "Enviando..." : "Enviar Instruções"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Verifique seu Email</h2>
              <p className="text-sm text-slate-400 mb-4">
                Se uma conta existir com o email <span className="text-white font-medium">{email}</span>,
                você receberá instruções para redefinir sua senha.
              </p>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
                <p className="text-xs text-amber-300">
                  <strong>Nota:</strong> O serviço de email ainda não está configurado.
                  Entre em contato com o administrador do sistema para redefinir sua senha manualmente.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-700">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Voltar para o login
            </Link>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          &copy; {new Date().getFullYear()} ClickPro. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
