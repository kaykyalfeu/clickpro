"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import PasswordInput from "@/components/PasswordInput";

const steps = [
  {
    id: 1,
    title: "Crie sua conta",
    description: "Configure seu acesso ao ClickPro em segundos.",
    active: true,
  },
  {
    id: 2,
    title: "Configure seu workspace",
    description: "Organize seus clientes, canais e licenças.",
    active: false,
  },
  {
    id: 3,
    title: "Comece a automatizar",
    description: "Gerencie licenças e escale seu negócio.",
    active: false,
  },
];

export default function SignUpPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    setError("");
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setError(`Erro ao conectar com ${provider === "google" ? "Google" : "GitHub"}. Tente novamente.`);
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Create account
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar conta");
        setLoading(false);
        return;
      }

      // Auto-login after successful signup
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Conta criada, mas erro ao fazer login. Tente fazer login manualmente.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row lg:items-stretch lg:gap-0">
        <section className="relative flex w-full flex-col justify-between rounded-3xl bg-gradient-to-b from-[#7c3aed] via-[#4c1d95] to-black px-10 py-12 lg:w-1/2">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold backdrop-blur-sm">
                CP
              </div>
              <span className="text-lg font-bold tracking-wide">ClickPro</span>
            </div>

            <h1 className="mt-12 text-4xl font-bold leading-tight">
              Simplifique a Gestão<br />de Licenças
            </h1>
            <p className="mt-4 text-base text-white/80 leading-relaxed">
              A plataforma completa para gerenciar licenças, acompanhar métricas
              e escalar seu negócio de software com facilidade.
            </p>

            <div className="mt-8 flex gap-6 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Gestão centralizada
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Métricas em tempo real
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-start gap-4 rounded-2xl px-5 py-4 shadow-lg transition-colors ${
                  step.active
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/70"
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                    step.active ? "bg-black text-white" : "bg-white/20 text-white"
                  }`}
                >
                  {step.id}
                </div>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs opacity-70">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex w-full flex-col justify-center rounded-3xl bg-black px-10 py-12 lg:w-1/2 lg:px-12">
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold">Criar Conta</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Preencha seus dados para começar a usar o ClickPro.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleOAuthSignIn("google")}
                disabled={oauthLoading !== null || loading}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 py-3 text-sm font-medium transition hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === "google" ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="currentColor"
                  >
                    <path d="M21.35 11.1h-9.18v2.98h5.31c-.23 1.28-1.42 3.75-5.31 3.75-3.2 0-5.81-2.64-5.81-5.88s2.61-5.88 5.81-5.88c1.82 0 3.05.78 3.75 1.45l2.56-2.47C16.99 3.6 14.84 2.4 12.17 2.4 7.4 2.4 3.55 6.29 3.55 11.1s3.85 8.7 8.62 8.7c4.97 0 8.26-3.54 8.26-8.53 0-.57-.08-1.01-.18-1.44Z" />
                  </svg>
                )}
                {oauthLoading === "google" ? "Conectando..." : "Google"}
              </button>
              <button
                type="button"
                onClick={() => handleOAuthSignIn("github")}
                disabled={oauthLoading !== null || loading}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 py-3 text-sm font-medium transition hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === "github" ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M12 2.5C6.75 2.5 2.5 6.74 2.5 11.95c0 4.17 2.73 7.69 6.52 8.94.48.09.65-.21.65-.47 0-.23-.01-.84-.02-1.64-2.65.58-3.21-1.29-3.21-1.29-.43-1.1-1.05-1.39-1.05-1.39-.86-.6.07-.59.07-.59.95.07 1.45 1 1.45 1 .85 1.47 2.24 1.04 2.78.8.09-.62.33-1.04.6-1.28-2.11-.24-4.33-1.07-4.33-4.74 0-1.05.37-1.9 1-2.57-.1-.24-.44-1.2.1-2.5 0 0 .82-.26 2.7.98a9.15 9.15 0 0 1 2.46-.34c.84 0 1.68.12 2.46.34 1.88-1.24 2.7-.98 2.7-.98.54 1.3.2 2.26.1 2.5.62.67 1 1.52 1 2.57 0 3.68-2.22 4.5-4.34 4.73.34.3.65.9.65 1.82 0 1.31-.02 2.37-.02 2.69 0 .26.17.57.66.47 3.78-1.25 6.51-4.77 6.51-8.94 0-5.21-4.25-9.45-9.5-9.45Z" />
                  </svg>
                )}
                {oauthLoading === "github" ? "Conectando..." : "GitHub"}
              </button>
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
              <span className="h-px flex-1 bg-zinc-800" />
              Ou
              <span className="h-px flex-1 bg-zinc-800" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs text-zinc-400">Nome</label>
                  <input
                    type="text"
                    placeholder="ex. João"
                    value={formData.firstName}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs text-zinc-400">Sobrenome</label>
                  <input
                    type="text"
                    placeholder="ex. Silva"
                    value={formData.lastName}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs text-zinc-400">Email</label>
                <input
                  type="email"
                  placeholder="ex. joao@empresa.com"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <PasswordInput
                label="Senha"
                placeholder="Digite sua senha"
                value={formData.password}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, password: event.target.value }))
                }
                helperText="Mínimo de 8 caracteres."
                variant="dark"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
              >
                {loading ? "Criando conta..." : "Criar Conta Grátis"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              Já tem uma conta?{" "}
              <Link href="/login" className="font-semibold text-violet-400 hover:text-violet-300">
                Entrar
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
