"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getProviders, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type AuthView = "signin" | "signup";

interface AuthCardProps {
  initialView?: AuthView;
}

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

function PasswordField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>
      <div className="auth-password-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="auth-input auth-input-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          title={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? "🙈" : "👁️"}
        </button>
      </div>
    </div>
  );
}

export default function AuthCard({ initialView = "signin" }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [view, setView] = useState<AuthView>(initialView);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInError, setSignInError] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [superAdminLoading, setSuperAdminLoading] = useState(false);

  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");
  const [signUpError, setSignUpError] = useState("");
  const [signUpLoading, setSignUpLoading] = useState(false);

  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [availableProviders, setAvailableProviders] = useState({
    google: false,
    github: false,
  });

  const showOAuth = availableProviders.google || availableProviders.github;

  useEffect(() => {
    let isMounted = true;
    getProviders()
      .then((providers) => {
        if (!isMounted) return;
        setAvailableProviders({
          google: Boolean(providers?.google),
          github: Boolean(providers?.github),
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setAvailableProviders({ google: false, github: false });
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const viewClassName = useMemo(() => `auth-card ${view}`, [view]);

  async function handleOAuthSignIn(provider: "google" | "github") {
    setOauthLoading(provider);
    setSignInError("");
    setSignUpError("");
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      const message = `Erro ao conectar com ${provider === "google" ? "Google" : "GitHub"}. Tente novamente.`;
      setSignInError(message);
      setSignUpError(message);
      setOauthLoading(null);
    }
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setSignInError("");
    setSignInLoading(true);

    try {
      const normalizedEmail = signInEmail.toLowerCase().trim();
      const validateRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: signInPassword }),
      });

      const validateData = await validateRes.json();

      if (!validateData.ok) {
        setSignInError(validateData.error || "Erro ao validar credenciais");
        setSignInLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password: signInPassword,
        redirect: false,
      });

      if (result?.error) {
        setSignInError("Erro ao estabelecer sessão. Tente novamente.");
        setSignInLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setSignInError("Erro ao fazer login. Tente novamente.");
      setSignInLoading(false);
    }
  }

  async function handleSuperAdminLogin() {
    if (!signInEmail || !signInPassword) {
      setSignInError("Informe email e senha para acessar como super admin.");
      return;
    }
    setSignInError("");
    setSuperAdminLoading(true);

    try {
      const normalizedEmail = signInEmail.toLowerCase().trim();
      const validateRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: signInPassword }),
      });

      const validateData = await validateRes.json();

      if (!validateData.ok) {
        setSignInError(validateData.error || "Erro ao validar credenciais");
        setSuperAdminLoading(false);
        return;
      }

      if (validateData.user?.role !== "SUPER_ADMIN") {
        setSignInError("Sua conta não possui permissão de super admin.");
        setSuperAdminLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password: signInPassword,
        redirect: false,
        callbackUrl: "/admin",
      });

      if (result?.error) {
        setSignInError("Erro ao estabelecer sessão. Tente novamente.");
        setSuperAdminLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setSignInError("Erro ao fazer login. Tente novamente.");
      setSuperAdminLoading(false);
    }
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    setSignUpError("");

    if (signUpPassword !== signUpConfirm) {
      setSignUpError("As senhas não conferem.");
      return;
    }

    setSignUpLoading(true);

    try {
      const { firstName, lastName } = splitName(signUpName);
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email: signUpEmail,
          password: signUpPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSignUpError(data.error || "Erro ao criar conta");
        setSignUpLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: signUpEmail,
        password: signUpPassword,
        redirect: false,
      });

      if (result?.error) {
        setSignUpError("Conta criada, mas erro ao fazer login. Tente fazer login manualmente.");
        setSignUpLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setSignUpError("Erro de conexão. Tente novamente.");
      setSignUpLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className={viewClassName} data-view={view}>
        <ul className="auth-nav">
          <li className="active-bar" aria-hidden="true" />
          <li className="auth-logo">
            <div className="logo-badge">CP</div>
            <span>ClickPro</span>
          </li>
          <li>
            <button
              type="button"
              className={`nav-button signin ${view === "signin" ? "active" : ""}`}
              onClick={() => setView("signin")}
            >
              <i className="ai-person-check" aria-hidden="true" />
              <span>Sign In</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`nav-button signup ${view === "signup" ? "active" : ""}`}
              onClick={() => setView("signup")}
            >
              <i className="ai-person-add" aria-hidden="true" />
              <span>Sign Up</span>
            </button>
          </li>
        </ul>

        <div className="auth-hero">
          <div className="auth-hero-inner">
            <div className="hero-content signin">
              <h2>Welcome Back.</h2>
              <h3>Please enter your credentials.</h3>
              <Image src="/file.svg" alt="Ilustração de login" width={220} height={140} />
            </div>
            <div className="hero-content signup">
              <h2>Sign Up Now.</h2>
              <h3>Join the crowd and get started.</h3>
              <Image src="/window.svg" alt="Ilustração de cadastro" width={220} height={140} />
            </div>
          </div>
        </div>

        <div className="auth-form">
          <div className="auth-forms">
            <form className="form-panel" onSubmit={handleSignIn}>
              <h4>Entrar</h4>
              <p>Use suas credenciais para acessar o portal.</p>

              {signInError && <div className="auth-alert">{signInError}</div>}

              <label className="auth-label" htmlFor="signin-email">
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                className="auth-input"
                value={signInEmail}
                onChange={(event) => setSignInEmail(event.target.value)}
                placeholder="voce@empresa.com"
                required
              />

              <PasswordField
                id="signin-password"
                label="Senha"
                value={signInPassword}
                placeholder="••••••••"
                onChange={setSignInPassword}
              />

              <div className="auth-inline-link-row">
                <Link href="/forgot-password" className="auth-inline-link">
                  Esqueci a senha
                </Link>
              </div>

              <button type="submit" className="auth-primary" disabled={signInLoading}>
                {signInLoading ? "Entrando..." : "Entrar"}
              </button>

              <button
                type="button"
                className="auth-superadmin-button"
                onClick={handleSuperAdminLogin}
                disabled={superAdminLoading}
              >
                {superAdminLoading ? "Entrando..." : "Acesso super admin"}
              </button>

              {showOAuth && (
                <div className="oauth-area">
                  <span>ou continue com</span>
                  <div className="oauth-buttons">
                    {availableProviders.google && (
                      <button
                        type="button"
                        onClick={() => handleOAuthSignIn("google")}
                        disabled={oauthLoading !== null || signInLoading || superAdminLoading}
                      >
                        Google
                      </button>
                    )}
                    {availableProviders.github && (
                      <button
                        type="button"
                        onClick={() => handleOAuthSignIn("github")}
                        disabled={oauthLoading !== null || signInLoading || superAdminLoading}
                      >
                        GitHub
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>

            <form className="form-panel" onSubmit={handleSignUp}>
              <h4>Criar conta</h4>
              <p>Preencha os dados para começar sua experiência.</p>

              {signUpError && <div className="auth-alert">{signUpError}</div>}

              <label className="auth-label" htmlFor="signup-name">
                Nome completo
              </label>
              <input
                id="signup-name"
                type="text"
                className="auth-input"
                value={signUpName}
                onChange={(event) => setSignUpName(event.target.value)}
                placeholder="Seu nome"
                required
              />

              <label className="auth-label" htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                className="auth-input"
                value={signUpEmail}
                onChange={(event) => setSignUpEmail(event.target.value)}
                placeholder="voce@empresa.com"
                required
              />

              <PasswordField
                id="signup-password"
                label="Senha"
                value={signUpPassword}
                placeholder="Crie uma senha"
                onChange={setSignUpPassword}
              />

              <div className="auth-inline-link-row">
                <Link href="/forgot-password" className="auth-inline-link">
                  Esqueci a senha
                </Link>
              </div>

              <PasswordField
                id="signup-confirm"
                label="Confirmar senha"
                value={signUpConfirm}
                placeholder="Repita a senha"
                onChange={setSignUpConfirm}
              />

              <button type="submit" className="auth-primary" disabled={signUpLoading}>
                {signUpLoading ? "Entrando..." : "Entrar"}
              </button>

              {showOAuth && (
                <div className="oauth-area">
                  <span>ou cadastre-se com</span>
                  <div className="oauth-buttons">
                    {availableProviders.google && (
                      <button
                        type="button"
                        onClick={() => handleOAuthSignIn("google")}
                        disabled={oauthLoading !== null || signUpLoading}
                      >
                        Google
                      </button>
                    )}
                    {availableProviders.github && (
                      <button
                        type="button"
                        onClick={() => handleOAuthSignIn("github")}
                        disabled={oauthLoading !== null || signUpLoading}
                      >
                        GitHub
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
