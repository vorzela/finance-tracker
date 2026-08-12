import { isAxiosError } from 'axios';

function toErrorMessage(
  error: unknown,
  op: string = 'Request failed',
  fallback: string = 'Something went wrong, please try again later',
): string {
  if (isAxiosError(error)) {
    if (error.response) {
      const data = error.response.data ?? {};
      return (
        (typeof data.error === 'string' && data.error) ||
        (typeof data.message === 'string' && data.message) ||
        `${op} (${error.response.status})`
      );
    }
    if (error.code === 'ECONNABORTED') return 'Request timed out';
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// This function is useful for displaying error messages in the UI, where you want to show a user-friendly message.
export function getErrorMessage(error: unknown, op?: string): string {
  return toErrorMessage(error, op);
}

// This function is useful for throwing errors in async functions, where you want to preserve the stack trace.
export function apiError(error: unknown, op?: string): never {
  throw new Error(toErrorMessage(error, op));
}
