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
POSTGRES_PASSWORD=0123456789abcdef0123456789abcdef
DATABASE_URL=postgresql://oasis:0123456789abcdef0123456789abcdef@postgres:5432/oasis
JWT_SECRET=0123456789abcdef0123456789abcdef
NEXTAUTH_SECRET=0123456789abcdef0123456789abcdefnextauth
NEXTAUTH_URL=https://care.example.org
NEXT_PUBLIC_API_URL=https://care.example.org/graphql
NEXT_PUBLIC_SITE_URL=https://care.example.org
ALLOWED_ORIGINS=https://care.example.org
AUTH_IDENTITY_PROVIDER=clerk
CLERK_ISSUER=https://clerk.provider.org
CLERK_JWKS_URL=https://clerk.provider.org/.well-known/jwks.json
CLERK_AUDIENCE=oasis-production-api
CLERK_AUTHORIZED_PARTIES=https://care.example.org
CLERK_SECRET_KEY=0123456789abcdef0123456789abcdefclerk
NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2FyZS5leGFtcGxlLm9yZyQ=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=https://care.example.org/sign-in
LOCAL_AUTH_ENABLED=false
NEXT_PUBLIC_LOCAL_AUTH_ENABLED=false
DEMO_MODE=false
RUN_MIGRATIONS=false
GDPR_ENABLED=false
METRICS_ENABLED=false
AI_SUMMARY_ENABLED=false
ENV

cd "$REPO_ROOT"

DATABASE_URL=postgresql://oasis:0123456789abcdef0123456789abcdef@postgres:5432/oasis \
  pnpm --dir libs/db exec prisma validate
pnpm --filter @oasis/api test
pnpm --filter @oasis/api build
pnpm --filter @oasis/web build
docker build -f apps/api/Dockerfile -t oasis-api:v2 .
docker build -f apps/web/Dockerfile -t oasis-web:v2 .
docker compose --env-file "$TEMP_ENV" -f deploy/v2/docker-compose.yml config
docker run --rm -v "$PWD/deploy/v2/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2 caddy validate --config /etc/caddy/Caddyfile
bash -n deploy/v2/scripts/smoke-test.sh
bash -n deploy/v2/scripts/backup-postgres.sh
bash -n deploy/v2/scripts/restore-postgres.sh
node --test apps/web/next.config.test.js
node --test deploy/v2/Caddyfile.test.mjs
node --test deploy/v2/scripts/preflight-env.test.mjs
node --test deploy/v2/scripts/smoke-test.test.mjs
node deploy/v2/scripts/preflight-env.mjs "$TEMP_ENV"
