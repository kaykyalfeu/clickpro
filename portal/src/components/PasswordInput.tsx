"use client";

import { useState, forwardRef, type InputHTMLAttributes } from "react";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Label text displayed above the input */
  label?: string;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Error message to display */
  error?: string;
  /** Additional class names for the container */
  containerClassName?: string;
  /** Additional class names for the label */
  labelClassName?: string;
  /** Visual variant */
  variant?: "default" | "dark";
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label,
      helperText,
      error,
      containerClassName = "",
      labelClassName = "",
      variant = "default",
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(false);

    const toggleVisibility = () => {
      setIsVisible((prev) => !prev);
    };

    // Prevent focus loss when clicking the button
    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
    };

    const inputId = id || `password-input-${Math.random().toString(36).slice(2, 9)}`;

    // Base styles for different variants
    const variantStyles = {
      default: {
        input:
          "w-full px-4 py-3 pr-12 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all",
        label: "block text-sm font-medium text-slate-300 mb-2",
        button: "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:text-slate-200",
        helper: "mt-2 text-xs text-slate-500",
        error: "mt-2 text-xs text-red-400",
      },
      dark: {
        input:
          "w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 pr-12 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none transition-all",
        label: "mb-2 block text-xs text-zinc-400",
        button: "absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none focus:text-zinc-300",
        helper: "mt-2 text-xs text-zinc-500",
        error: "mt-2 text-xs text-red-400",
      },
    };

    const styles = variantStyles[variant];

    return (
      <div className={containerClassName}>
        {label && (
          <label htmlFor={inputId} className={`${styles.label} ${labelClassName}`}>
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isVisible ? "text" : "password"}
            className={`${styles.input} ${className}`}
            {...props}
          />
          <button
            type="button"
            onClick={toggleVisibility}
            onMouseDown={handleMouseDown}
            className={styles.button}
            aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={isVisible}
            tabIndex={0}
          >
            {isVisible ? (
              // Eye-off icon (password visible, click to hide)
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              </svg>
            ) : (
              // Eye icon (password hidden, click to show)
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        </div>
        {helperText && !error && <p className={styles.helper}>{helperText}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
