// ============================================
// Client-safe License Utilities
// ============================================
// This file contains utilities that can safely be imported
// in client components without pulling in server-only code.

export interface ActivationErrorResponse {
  ok: false;
  error?: string;
  reason?: string;
  hint?: string;
}

/**
 * Format activation error message from API response.
 * Includes hint if available for better user guidance.
 */
export function formatActivationError(data: ActivationErrorResponse): string {
  const baseError = data.error || data.reason || "Falha ao ativar licença.";
  if (data.hint) {
    return `${baseError} — ${data.hint}`;
  }
  return baseError;
}
