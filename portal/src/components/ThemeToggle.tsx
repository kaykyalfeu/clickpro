"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      className="px-3 py-2 rounded-lg text-xl hover:bg-slate-700/50 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
      style={{
        backgroundColor: "var(--surface-2)",
        color: "var(--text)",
        boxShadow: `0 0 0 0 var(--ring)`,
        filter: theme === "light" ? "brightness(0.4)" : "none",
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 3px var(--ring)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 0 var(--ring)`;
      }}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
