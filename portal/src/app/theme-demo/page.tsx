"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeDemoPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen p-8" style={{ background: "linear-gradient(to bottom, var(--bg), var(--bg-elevated))" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--text)" }}>
            ClickPro Theme System
          </h1>
          <p style={{ color: "var(--text-muted)" }}>
            Sistema de tema claro/escuro profissional
          </p>
        </div>

        {/* Theme Toggle */}
        <div
          className="p-6 rounded-2xl border mb-8"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: `0 4px 12px var(--shadow)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>
                Tema Atual: {theme === "dark" ? "Escuro 🌙" : "Claro ☀️"}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Alterne entre os temas para ver a diferença
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="px-6 py-3 rounded-xl font-semibold transition-all"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-contrast)",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
              }}
            >
              Alternar Tema
            </button>
          </div>
        </div>

        {/* Color Palette */}
        <div
          className="p-6 rounded-2xl border mb-8"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: `0 4px 12px var(--shadow)`,
          }}
        >
          <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--text)" }}>
            Paleta de Cores
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="h-20 rounded-lg mb-2" style={{ backgroundColor: "var(--bg)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Background</p>
            </div>
            <div>
              <div className="h-20 rounded-lg mb-2 border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Surface</p>
            </div>
            <div>
              <div className="h-20 rounded-lg mb-2" style={{ backgroundColor: "var(--primary)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Primary</p>
            </div>
            <div>
              <div className="h-20 rounded-lg mb-2" style={{ backgroundColor: "var(--accent)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Accent</p>
            </div>
          </div>
        </div>

        {/* Components Demo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Card 1 */}
          <div
            className="p-6 rounded-2xl border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: `0 4px 12px var(--shadow)`,
            }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>
              Card de Exemplo
            </h3>
            <p style={{ color: "var(--text-muted)" }}>
              Este é um exemplo de card usando design tokens
            </p>
            <div className="mt-4">
              <input
                type="text"
                placeholder="Campo de texto"
                className="w-full px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: "var(--surface-2)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>
          </div>

          {/* Card 2 */}
          <div
            className="p-6 rounded-2xl border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: `0 4px 12px var(--shadow)`,
            }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>
              Botões
            </h3>
            <div className="space-y-3">
              <button
                className="w-full px-4 py-2 rounded-lg font-medium"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-contrast)",
                }}
              >
                Botão Primary
              </button>
              <button
                className="w-full px-4 py-2 rounded-lg font-medium border"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text)",
                  borderColor: "var(--border)",
                }}
              >
                Botão Secondary
              </button>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        <div
          className="p-6 rounded-2xl border"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: `0 4px 12px var(--shadow)`,
          }}
        >
          <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--text)" }}>
            Mensagens de Status
          </h2>
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                borderColor: "rgba(34, 197, 94, 0.3)",
              }}
            >
              <p style={{ color: "var(--success)" }}>✓ Operação realizada com sucesso!</p>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                borderColor: "rgba(239, 68, 68, 0.3)",
              }}
            >
              <p style={{ color: "var(--danger)" }}>✗ Erro ao processar a operação</p>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.15)",
                borderColor: "rgba(245, 158, 11, 0.3)",
              }}
            >
              <p style={{ color: "#F59E0B" }}>⚠ Atenção: Verifique os dados inseridos</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Sistema de tema implementado com CSS Variables e React Context
          </p>
        </div>
      </div>
    </div>
  );
}
