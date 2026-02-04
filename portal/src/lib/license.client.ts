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
