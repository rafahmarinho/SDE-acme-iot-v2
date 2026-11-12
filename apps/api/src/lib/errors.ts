/**
 * Typed HTTP error. `code` is a stable, non-sensitive identifier returned to clients; internal details
 * (SQL errors, stack traces) are never attached (T2139, T49).
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'HttpError';
  }
}
