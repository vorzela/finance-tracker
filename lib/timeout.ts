/**
 * lib/timeout.ts
 *
 * Rejects if `promise` doesn't settle within `ms`, so a stalled network
 * call (most commonly: a request that hangs rather than failing fast while
 * offline, which happens more often than you'd expect — a "connected but
 * no internet" state can leave a request neither resolving nor rejecting
 * for a long time) can never leave a caller waiting forever.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
