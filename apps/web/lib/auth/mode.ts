export type AuthMode = 'clerk' | 'cognito' | 'local';

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

export function isLocalAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = (env.NODE_ENV || 'development').trim().toLowerCase();
  if (nodeEnv !== 'development') {
    return false;
  }

  return isTruthy(env.LOCAL_AUTH_ENABLED)
    || isTruthy(env.AUTH_LOCAL_ENABLED)
    || isTruthy(env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED)
    || isTruthy(env.DEV_AUTH_ENABLED);
}

export function resolveAuthMode(env: NodeJS.ProcessEnv = process.env): AuthMode {
  const provider = (env.AUTH_IDENTITY_PROVIDER || env.NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER || '').trim().toLowerCase();
  if (provider === 'clerk') {
    return 'clerk';
  }

  return isLocalAuthEnabled(env) ? 'local' : 'cognito';
}
