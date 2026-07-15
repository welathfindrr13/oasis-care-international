#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/../.." && pwd)"
TEMP_ENV="$(mktemp)"

cleanup() {
  rm -f "$TEMP_ENV"
}
trap cleanup EXIT

cat > "$TEMP_ENV" <<'ENV'
NODE_ENV=production
APP_DOMAIN=care.example.org
ACME_EMAIL=ops@example.org
POSTGRES_DB=oasis
POSTGRES_USER=oasis
SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID=shift-local-verification
SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON=[]
VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID=visit-local-verification
NEXTAUTH_URL=https://care.example.org
NEXT_PUBLIC_API_URL=https://care.example.org/graphql
NEXT_PUBLIC_SITE_URL=https://care.example.org
ALLOWED_ORIGINS=https://care.example.org
AUTH_IDENTITY_PROVIDER=clerk
CLERK_ISSUER=https://clerk.provider.org
CLERK_JWKS_URL=https://clerk.provider.org/.well-known/jwks.json
CLERK_AUDIENCE=oasis-production-api
CLERK_AUTHORIZED_PARTIES=https://care.example.org
PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID=org_oasis_platform_ops
PLATFORM_OPERATOR_CLERK_SUBJECTS=user_oasis_platform_operator
NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk
NEXT_PUBLIC_CLERK_CSP_ORIGINS=https://care.example.org
NEXT_PUBLIC_CLERK_SIGN_IN_URL=https://care.example.org/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://care.example.org/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=https://care.example.org/today
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=https://care.example.org/today
LOCAL_AUTH_ENABLED=false
NEXT_PUBLIC_LOCAL_AUTH_ENABLED=false
DEMO_MODE=false
RUN_MIGRATIONS=false
GDPR_ENABLED=false
METRICS_ENABLED=false
AI_SUMMARY_ENABLED=false
ENV

# Assemble local-only values at runtime so the repository never contains
# credential-shaped proof or Clerk keys. Production must supply real values separately.
LOCAL_POSTGRES_PASSWORD="$(printf '%s' 'local-verification-' 'database-password-value')"
LOCAL_DATABASE_URL="postgresql://oasis:${LOCAL_POSTGRES_PASSWORD}@postgres:5432/oasis"
LOCAL_JWT_SECRET="$(printf '%s' 'local-verification-' 'jwt-signing-value')"
LOCAL_NEXTAUTH_SECRET="$(printf '%s' 'local-verification-' 'web-session-value')"
LOCAL_CLERK_PUBLISHABLE_KEY="pk_test_$(printf '%s' 'care.example.org$' | base64 | tr -d '\n')"
printf 'POSTGRES_PASSWORD=%s\n' "$LOCAL_POSTGRES_PASSWORD" >> "$TEMP_ENV"
printf 'DATABASE_URL=%s\n' "$LOCAL_DATABASE_URL" >> "$TEMP_ENV"
printf 'JWT_SECRET=%s\n' "$LOCAL_JWT_SECRET" >> "$TEMP_ENV"
printf 'NEXTAUTH_SECRET=%s\n' "$LOCAL_NEXTAUTH_SECRET" >> "$TEMP_ENV"
printf 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=%s\n' "$LOCAL_CLERK_PUBLISHABLE_KEY" >> "$TEMP_ENV"
printf 'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET=%s\n' "$(printf '%s' 'local-verification-shift-proof-value' | base64 | tr -d '\n')" >> "$TEMP_ENV"
printf 'VISIT_COMPLETION_PROOF_ACTIVE_SECRET=%s\n' "$(printf '%s' 'local-verification-' 'visit-proof-' 'not-a-credential-value')" >> "$TEMP_ENV"
printf 'CLERK_SECRET_KEY=%s\n' "$(printf '%s' 'local-verification-' 'not-a-credential-value')" >> "$TEMP_ENV"

cd "$REPO_ROOT"

DATABASE_URL="$LOCAL_DATABASE_URL" \
  pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
pnpm --filter @oasis/api build
NEXT_PUBLIC_CLERK_CSP_ORIGINS=https://care.example.org pnpm --filter @oasis/web build
docker build -f apps/api/Dockerfile -t oasis-api:v2 .
docker build --build-arg NEXT_PUBLIC_CLERK_CSP_ORIGINS=https://care.example.org -f apps/web/Dockerfile -t oasis-web:v2 .
docker compose --env-file "$TEMP_ENV" -f deploy/v2/docker-compose.yml config
docker run --rm --env-file "$TEMP_ENV" -v "$PWD/deploy/v2/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2 caddy validate --config /etc/caddy/Caddyfile
bash -n deploy/v2/scripts/smoke-test.sh
bash -n deploy/v2/scripts/backup-postgres.sh
bash -n deploy/v2/scripts/restore-postgres.sh
bash -n deploy/v2/scripts/rehearse-backup-restore.sh
bash -n deploy/v2/scripts/backup-restore.integration.sh
bash -n deploy/v2/scripts/install-production-signal-scheduler.sh
bash -n deploy/v2/scripts/verify-production-signal-scheduler.sh
bash -n deploy/v2/scripts/verify-production-signal-systemd.sh
bash -n deploy/v2/scripts/production-signal-installer.integration.sh
if command -v systemd-analyze >/dev/null 2>&1; then
  deploy/v2/scripts/verify-production-signal-systemd.sh
fi
node --test apps/web/next.config.test.js
node --test deploy/v2/Caddyfile.test.mjs
node --test deploy/v2/scripts/preflight-env.test.mjs
node --test deploy/v2/scripts/smoke-test.test.mjs
node --test deploy/v2/scripts/backup-crypto.test.mjs
node --test deploy/v2/scripts/backup-restore.test.mjs
node --test deploy/v2/scripts/production-signals.test.mjs
node --test deploy/v2/scripts/production-signal-runner.test.mjs
node --test deploy/v2/scripts/production-signal-scheduler.test.mjs
node deploy/v2/scripts/preflight-env.mjs "$TEMP_ENV"
deploy/v2/scripts/backup-restore.integration.sh
node --check deploy/v2/scripts/production-signals.mjs
node --check deploy/v2/scripts/production-signal-runner.mjs
