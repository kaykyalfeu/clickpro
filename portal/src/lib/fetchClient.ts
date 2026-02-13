// ---------------------------------------------------------------------------
// fetchClient.ts — Frontend fetch with retry, backoff, and abort support
// ---------------------------------------------------------------------------

/** HTTP status codes that should never be retried. */
const NO_RETRY_STATUSES = new Set([400, 401, 403, 404, 405, 409, 422]);

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

interface FetchWithRetryOptions extends RequestInit {
  /** Maximum number of retries (default: 3). */
  maxRetries?: number;
  /** Abort signal — pass from AbortController to cancel on unmount. */
  signal?: AbortSignal;
}

/**
 * Fetch wrapper with:
 * - Exponential backoff retry (up to `maxRetries` times)
 * - No retry on 4xx client errors (401, 403, 404, etc.)
 * - Respects AbortSignal for component unmount cancellation
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { maxRetries = MAX_RETRIES, ...fetchOptions } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if already aborted before attempting
    if (fetchOptions.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    try {
      const response = await fetch(url, fetchOptions);

      // Don't retry on client errors — they won't change on retry
      if (NO_RETRY_STATUSES.has(response.status)) {
        return response;
      }

      // Success or redirect — return immediately
      if (response.ok || response.status < 500) {
        return response;
      }

      // Server error (5xx) — retry if we have attempts left
      if (attempt < maxRetries) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await delay(backoff, fetchOptions.signal);
        continue;
      }

      // Out of retries — return the error response
      return response;
    } catch (error) {
      // AbortError — always rethrow, never retry
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      // Network error — retry if we have attempts left
      if (attempt < maxRetries) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        try {
          await delay(backoff, fetchOptions.signal);
        } catch {
          // Aborted during backoff
          throw lastError;
        }
        continue;
      }
    }
  }

  throw lastError ?? new Error("Fetch failed after retries");
}

function delay(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }, { once: true });
  });
}
