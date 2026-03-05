/**
 * Redacts e-mail addresses and UK mobile numbers.
 * john.doe@example.com → j***@example.com
 * 07911 123 456        → 07*** *** ***
 */
export class Masker {
  private static email = /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
  private static phone =
    /(\+?44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}/g;

  static mask(text: string): string;
  static mask<T>(text: T): T;
  static mask(text: unknown): unknown {
    // pino-http may pass non-string values (objects, arrays, etc.)
    if (typeof text !== 'string') {
      return text;
    }
    return text
      .replace(this.email, (_m, user: string, host: string) => `${user[0]}***@${host}`)
      .replace(this.phone, '07*** *** ***');
  }
}
