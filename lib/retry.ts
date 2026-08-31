export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; onRetry?: (attempt: number) => void } = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        opts.onRetry?.(attempt);
        await new Promise((r) => setTimeout(r, attempt * 1500)); // 1.5s, 3s, 4.5s
      }
    }
  }
  throw lastError;
}
