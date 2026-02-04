"use client";

import { Suspense, useState } from "react";
import { getSession, signIn, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [superAdminLoading, setSuperAdminLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  async function handleOAuthSignIn(provider: "google" | "github") {
    setOauthLoading(provider);
    setError("");
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setError(`Erro ao conectar com ${provider === "google" ? "Google" : "GitHub"}. Tente novamente.`);
      setOauthLoading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Pre-validate credentials to get detailed error messages
      const validateRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const validateData = await validateRes.json();

      if (!validateData.ok) {
        setError(validateData.error || "Erro ao validar credenciais");
        setLoading(false);
        return;
      }

      // Credentials are valid, now sign in with NextAuth
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Erro ao estabelecer sessão. Tente novamente.");
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

  async function handleSuperAdminLogin() {
    if (!email || !password) {
      setError("Informe email e senha para acessar como super admin.");
      return;
    }
    setError("");
    setSuperAdminLoading(true);

    try {
      // Pre-validate credentials to get detailed error messages
      const validateRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const validateData = await validateRes.json();

      if (!validateData.ok) {
        setError(validateData.error || "Erro ao validar credenciais");
        setSuperAdminLoading(false);
        return;
      }

      // Check if user is a super admin before signing in
      if (validateData.user?.role !== "SUPER_ADMIN") {
        setError("Sua conta não possui permissão de super admin.");
        setSuperAdminLoading(false);
        return;
      }

      // Credentials are valid and user is super admin, now sign in
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/admin",
      });

      if (result?.error) {
        setError("Erro ao estabelecer sessão. Tente novamente.");
        setSuperAdminLoading(false);
        return;
      }

      // Wait for session to be updated and retry getSession a few times
      // This fixes the race condition where JWT may not be ready immediately
      let session = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        session = await getSession();
        if (session?.user?.role) break;
      }

      if (session?.user?.role !== "SUPER_ADMIN") {
        setError("Erro de sessão. Tente novamente.");
        await signOut({ redirect: false });
        setSuperAdminLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Erro ao fazer login. Tente novamente.");
      setSuperAdminLoading(false);
    }
  }

  return (
    <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 shadow-xl">
      <h2 className="text-xl font-semibold text-white text-center mb-6">
        Entrar no Portal
      </h2>

      {/* OAuth Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => handleOAuthSignIn("google")}
          disabled={oauthLoading !== null || loading || superAdminLoading}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900/50 border border-slate-600 text-white text-sm font-medium hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {oauthLoading === "google" ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M21.35 11.1h-9.18v2.98h5.31c-.23 1.28-1.42 3.75-5.31 3.75-3.2 0-5.81-2.64-5.81-5.88s2.61-5.88 5.81-5.88c1.82 0 3.05.78 3.75 1.45l2.56-2.47C16.99 3.6 14.84 2.4 12.17 2.4 7.4 2.4 3.55 6.29 3.55 11.1s3.85 8.7 8.62 8.7c4.97 0 8.26-3.54 8.26-8.53 0-.57-.08-1.01-.18-1.44Z" />
            </svg>
          )}
          Google
        </button>
        <button
          type="button"
          onClick={() => handleOAuthSignIn("github")}
          disabled={oauthLoading !== null || loading || superAdminLoading}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900/50 border border-slate-600 text-white text-sm font-medium hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {oauthLoading === "github" ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 2.5C6.75 2.5 2.5 6.74 2.5 11.95c0 4.17 2.73 7.69 6.52 8.94.48.09.65-.21.65-.47 0-.23-.01-.84-.02-1.64-2.65.58-3.21-1.29-3.21-1.29-.43-1.1-1.05-1.39-1.05-1.39-.86-.6.07-.59.07-.59.95.07 1.45 1 1.45 1 .85 1.47 2.24 1.04 2.78.8.09-.62.33-1.04.6-1.28-2.11-.24-4.33-1.07-4.33-4.74 0-1.05.37-1.9 1-2.57-.1-.24-.44-1.2.1-2.5 0 0 .82-.26 2.7.98a9.15 9.15 0 0 1 2.46-.34c.84 0 1.68.12 2.46.34 1.88-1.24 2.7-.98 2.7-.98.54 1.3.2 2.26.1 2.5.62.67 1 1.52 1 2.57 0 3.68-2.22 4.5-4.34 4.73.34.3.65.9.65 1.82 0 1.31-.02 2.37-.02 2.69 0 .26.17.57.66.47 3.78-1.25 6.51-4.77 6.51-8.94 0-5.21-4.25-9.45-9.5-9.45Z" />
            </svg>
          )}
          GitHub
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span className="h-px flex-1 bg-slate-700" />
        <span className="text-xs text-slate-500">ou continue com email</span>
        <span className="h-px flex-1 bg-slate-700" />
      </div>

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
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
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

        <button
          type="button"
          onClick={handleSuperAdminLogin}
          disabled={superAdminLoading}
          className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {superAdminLoading ? "Entrando como super admin..." : "Acesso super admin"}
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
        <p className="text-center text-slate-400 text-sm mt-2">
          Ainda não tem conta?{" "}
          <Link href="/signup" className="text-violet-300 hover:text-violet-200">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
