export type AuthMode = 'cognito' | 'local';

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
  return isLocalAuthEnabled(env) ? 'local' : 'cognito';
}

