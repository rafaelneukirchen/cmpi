/**
 * Retry helpers with exponential backoff for transient errors (503, 504, 429, network).
 */

const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);

export function isTransientError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;

  // HTTP status (fetch Response, supabase FunctionsHttpError, PostgREST)
  const status: number | undefined =
    err.status ?? err.statusCode ?? err.context?.status ?? err.response?.status;
  if (status && TRANSIENT_STATUS.has(status)) return true;

  // Network / fetch failures
  const msg = String(err.message ?? err).toLowerCase();
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("temporarily unavailable")
  ) {
    return true;
  }

  return false;
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run an async function with exponential backoff retry on transient errors.
 * Delays: base, base*2, base*4 ... capped at maxDelay, plus jitter.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { retries = 3, baseDelayMs = 500, maxDelayMs = 8000, onRetry } = opts;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries || !isTransientError(err)) throw err;
      const expo = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = Math.random() * (expo * 0.3);
      onRetry?.(attempt + 1, err);
      await sleep(expo + jitter);
    }
  }
  throw lastError;
}

/**
 * Wrapper for supabase.functions.invoke() with retry on transient errors.
 *
 * Usage:
 *   const { data, error } = await invokeWithRetry(supabase, "instagram-insights", { body });
 */
export async function invokeWithRetry<T = any>(
  supabase: { functions: { invoke: (name: string, options?: any) => Promise<{ data: T | null; error: any }> } },
  functionName: string,
  options?: any,
  retryOptions?: RetryOptions,
): Promise<{ data: T | null; error: any }> {
  return retryWithBackoff(async () => {
    const result = await supabase.functions.invoke(functionName, options);
    // Treat transient HTTP errors as throwable so retry kicks in
    if (result.error && isTransientError(result.error)) {
      throw result.error;
    }
    return result;
  }, retryOptions);
}
