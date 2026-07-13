const DEFAULT_CALLBACK_URL = '/access';
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const INVALID_PERCENT_ESCAPE = /%(?![0-9a-fA-F]{2})/;

export function normalizeCallbackUrl(
  value: string | null | undefined,
  allowedOrigin?: string,
): string {
  if (!value) {
    return DEFAULT_CALLBACK_URL;
  }

  if (CONTROL_CHARACTER.test(value) || INVALID_PERCENT_ESCAPE.test(value)) {
    return DEFAULT_CALLBACK_URL;
  }

  try {
    const decodedValue = decodeURI(value);
    if (CONTROL_CHARACTER.test(decodedValue) || decodedValue.includes('\\')) {
      return DEFAULT_CALLBACK_URL;
    }

    const internalBase = 'https://oasis.invalid';
    const isRelativePath = value.startsWith('/') && !value.startsWith('//');
    const callbackUrl = isRelativePath
      ? new URL(value, internalBase)
      : new URL(value);
    const expectedOrigin = isRelativePath
      ? internalBase
      : allowedOrigin
        ? new URL(allowedOrigin).origin
        : null;

    if (!expectedOrigin || callbackUrl.origin !== expectedOrigin) {
      return DEFAULT_CALLBACK_URL;
    }

    const normalizedValue = `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
    return normalizedValue.startsWith('/') && !normalizedValue.startsWith('//')
      ? normalizedValue
      : DEFAULT_CALLBACK_URL;
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
}
