"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeProvider";

type ThemeOption = {
  value: "light" | "dark";
  label: string;
};

const OPTIONS: ThemeOption[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

function ThemeIcon({ theme }: { theme: "light" | "dark" }) {
  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-icon-svg">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-icon-svg">
      <path
        d="M20 13.8A8 8 0 1 1 10.2 4a7 7 0 1 0 9.8 9.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="theme-menu" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="theme-toggle"
        title="Selecionar tema"
        aria-label="Selecionar tema"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="theme-toggle-icon" aria-hidden="true">
          <ThemeIcon theme={theme} />
        </span>
      </button>

      {open && (
        <div role="menu" aria-label="Tema" className="theme-dropdown">
          {OPTIONS.map((option) => {
            const isActive = option.value === theme;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={`theme-option ${isActive ? "active" : ""}`}
              >
                <span className="theme-option-icon" aria-hidden="true">
                  <ThemeIcon theme={option.value} />
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
