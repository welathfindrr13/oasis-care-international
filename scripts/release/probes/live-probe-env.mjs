export function requireLiveProbeOptIn() {
  if (process.env.ALLOW_LIVE_RELEASE_PROBES !== 'true') {
    throw new Error('LIVE_PROBE_OPT_IN_REQUIRED: set ALLOW_LIVE_RELEASE_PROBES=true to run live release probes');
  }
}

export function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`LIVE_PROBE_ENV_REQUIRED: ${name}`);
  }
  return value;
}

export function getLiveProbeBaseUrl() {
  requireLiveProbeOptIn();
  return requiredEnv('PLAYWRIGHT_BASE_URL').replace(/\/+$/, '');
}

export function getLiveProbeAccount(role) {
  const prefix = `PLAYWRIGHT_${role.toUpperCase()}`;
  return {
    email: requiredEnv(`${prefix}_EMAIL`),
    password: requiredEnv(`${prefix}_PASSWORD`),
  };
}
