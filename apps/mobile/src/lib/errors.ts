/** Error whose message is safe to show to users (no internals, no account enumeration). */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export function toUserMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return err instanceof UserFacingError ? err.message : fallback;
}
