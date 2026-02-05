"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      title={isDark ? "Alternar para tema claro" : "Alternar para tema escuro"}
      aria-label={isDark ? "Alternar para tema claro" : "Alternar para tema escuro"}
    >
      <i className={isDark ? "ai-sun" : "ai-moon"} aria-hidden="true" />
    </button>
  );
}
