const ACKNOWLEDGEMENT = "reset-test-data";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const GITHUB_CI_POSTGRES_HOST = "postgres";
const ALLOWED_DATABASES = new Set(["oasis_test"]);

export function assertSafeTestDatabaseSeed(env = process.env) {
  if (env.OASIS_TEST_DATABASE_SEED_ACK !== ACKNOWLEDGEMENT) {
    throw new Error(
      `Refusing test seed: set OASIS_TEST_DATABASE_SEED_ACK=${ACKNOWLEDGEMENT}`,
    );
  }

  const nodeEnv = String(env.NODE_ENV || "")
    .trim()
    .toLowerCase();
  if (nodeEnv === "production" || nodeEnv === "staging") {
    throw new Error(`Refusing test seed in NODE_ENV=${nodeEnv}`);
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(String(env.DATABASE_URL || ""));
  } catch {
    throw new Error("Refusing test seed: DATABASE_URL must be a valid URL");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol)) {
    throw new Error("Refusing test seed: DATABASE_URL must use PostgreSQL");
  }

  const hostname = databaseUrl.hostname.toLowerCase();
  const exactGithubServiceHost =
    env.GITHUB_ACTIONS === "true" && hostname === GITHUB_CI_POSTGRES_HOST;
  if (!LOOPBACK_HOSTS.has(hostname) && !exactGithubServiceHost) {
    throw new Error(
      "Refusing test seed: database host must be loopback or the exact GitHub Actions Postgres service host",
    );
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname).replace(
    /^\/+|\/+$/g,
    "",
  );
  if (!ALLOWED_DATABASES.has(databaseName)) {
    throw new Error(
      `Refusing test seed: database name must be one of ${Array.from(ALLOWED_DATABASES).join(", ")}`,
    );
  }

  return Object.freeze({ databaseName, hostname });
}
