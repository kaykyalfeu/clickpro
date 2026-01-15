"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou senha incorretos");
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Erro ao fazer login. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 shadow-xl">
      <h2 className="text-xl font-semibold text-white text-center mb-6">
        Entrar no Portal
      </h2>

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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/30"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 shadow-xl">
      <h2 className="text-xl font-semibold text-white text-center mb-6">
        Entrar no Portal
      </h2>
      <div className="animate-pulse space-y-5">
        <div className="h-12 bg-slate-700 rounded-xl" />
        <div className="h-12 bg-slate-700 rounded-xl" />
        <div className="h-12 bg-violet-600/50 rounded-xl" />
      </div>
    </div>
  );
}

export default function LoginPage() {
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

        {/* Login Form with Suspense */}
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-slate-500 text-sm mt-6">
          &copy; {new Date().getFullYear()} ClickPro. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
