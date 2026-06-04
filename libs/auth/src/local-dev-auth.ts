export const LOCAL_AUTH_ISSUER = 'oasis-local-dev';

export function isLocalAuthEnabledEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = (
    env.LOCAL_AUTH_ENABLED
    || env.DEV_AUTH_ENABLED
    || ''
  ).trim().toLowerCase();

  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

export function getLocalAuthIssuer(env: NodeJS.ProcessEnv = process.env): string {
  return (env.LOCAL_AUTH_ISSUER || LOCAL_AUTH_ISSUER).trim() || LOCAL_AUTH_ISSUER;
}
