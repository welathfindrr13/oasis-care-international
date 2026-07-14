export type AuthMode = 'clerk' | 'local';

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

export function isLocalAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = (env.NODE_ENV || 'development').trim().toLowerCase();
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    return false;
  }

  return isTruthy(env.LOCAL_AUTH_ENABLED)
    || isTruthy(env.AUTH_LOCAL_ENABLED)
    || isTruthy(env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED)
    || isTruthy(env.DEV_AUTH_ENABLED);
}

export function resolveAuthMode(env: NodeJS.ProcessEnv = process.env): AuthMode {
  const configuredProviders = [
    env.AUTH_IDENTITY_PROVIDER,
    env.NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER,
  ]
    .map((value) => (value || '').trim().toLowerCase())
    .filter(Boolean);
  const unsupportedProvider = configuredProviders.find(
    (provider) => provider !== 'clerk',
  );

  if (unsupportedProvider) {
    throw new Error(`Unsupported auth identity provider: ${unsupportedProvider}`);
  }

  if (configuredProviders.length > 0) {
    return 'clerk';
  }

  if (isLocalAuthEnabled(env)) {
    return 'local';
  }

  throw new Error(
    'Auth identity provider is not configured. Set AUTH_IDENTITY_PROVIDER=clerk or enable the explicit local development/test fixture.',
  );
}
