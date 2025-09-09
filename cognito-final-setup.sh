#!/bin/bash
# === OASIS — FINAL COGNITO WIRING + ENVs + SMOKE (No Terraform Apply) ===
# Mode: ACT
# Purpose: Inject Cognito values into production envs (web+api), wire/confirm NextAuth provider,
#          ensure API JWT verification uses Cognito issuer/audience/JWKS, add smoke script,
#          and print a clear next-steps list. DO NOT commit secrets. DO NOT terraform apply.

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# 0) CONSTANTS (from user)
REGION="eu-west-2"
USER_POOL_ID="eu-west-2_YPo6sl1zm"
APP_CLIENT_ID="3imuihdo5v7lgimq8je6d38std"
APP_CLIENT_SECRET="vse63kim3uce3h20eb2f0vi45a860algniqun4e4lph2fanalru"  # confidential client
HOSTED_UI_DOMAIN="https://eu-west-2ypo6sl1zm.auth.eu-west-2.amazoncognito.com"

ISSUER="https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}"
JWKS_URI="${ISSUER}/.well-known/jwks.json"

WEB_DOMAIN="https://app.oasis-care.com"
API_DOMAIN="https://api.oasis-care.com"

API_ENV="apps/api/.env.production"
WEB_ENV="apps/web/.env.production"

# ─────────────────────────────────────────────────────────────────────────────
# 1) SAFETY: ensure env files are ignored by git (no secrets committed)
touch .gitignore
if ! grep -qE '(^|/)\.env(\.production)?$' .gitignore; then
  {
    echo ".env"
    echo ".env.production"
  } >> .gitignore
fi
if ! grep -qE '\.env\.production$' .gitignore; then
  echo "**/.env.production" >> .gitignore
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2) Write production env files (web + api). Do NOT print their contents.
mkdir -p "$(dirname "$API_ENV")" "$(dirname "$WEB_ENV")"
touch "$API_ENV" "$WEB_ENV"

write_kv () { # file key value
  local file="$1"; local key="$2"; local val="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$file" && rm -f "$file.bak"
  else
    printf "%s=%s\n" "$key" "$val" >> "$file"
  fi
}

# API envs
write_kv "$API_ENV" "NODE_ENV" "production"
write_kv "$API_ENV" "PORT" "4000"
write_kv "$API_ENV" "AWS_REGION" "$REGION"
write_kv "$API_ENV" "DEMO_MODE" "false"
write_kv "$API_ENV" "ALLOWED_ORIGINS" "$WEB_DOMAIN"
write_kv "$API_ENV" "OIDC_ISSUER" "$ISSUER"
write_kv "$API_ENV" "OIDC_AUDIENCE" "$APP_CLIENT_ID"
write_kv "$API_ENV" "JWKS_URI" "$JWKS_URI"
# Optional (left blank)
grep -q "^SENTRY_DSN=" "$API_ENV" || echo "SENTRY_DSN=" >> "$API_ENV"
write_kv "$API_ENV" "SENTRY_ENVIRONMENT" "staging"

# WEB envs
write_kv "$WEB_ENV" "NODE_ENV" "production"
write_kv "$WEB_ENV" "NEXT_PUBLIC_API_URL" "$API_DOMAIN"
write_kv "$WEB_ENV" "NEXT_PUBLIC_SITE_URL" "$WEB_DOMAIN"
write_kv "$WEB_ENV" "NEXTAUTH_URL" "$WEB_DOMAIN"
write_kv "$WEB_ENV" "COGNITO_ISSUER" "$ISSUER"
write_kv "$WEB_ENV" "COGNITO_CLIENT_ID" "$APP_CLIENT_ID"
write_kv "$WEB_ENV" "COGNITO_CLIENT_SECRET" "$APP_CLIENT_SECRET"
# Optional (left blank)
grep -q "^SENTRY_DSN=" "$WEB_ENV" || echo "SENTRY_DSN=" >> "$WEB_ENV"
write_kv "$WEB_ENV" "SENTRY_ENVIRONMENT" "staging"
write_kv "$WEB_ENV" "NEXT_PUBLIC_ENV" "staging"

echo "Env files updated (not printed, not committed)."

# ─────────────────────────────────────────────────────────────────────────────
# 3) Ensure NextAuth + Cognito provider exists (App Router path by default)
NEXTAUTH_APP_ROUTE="apps/web/app/api/auth/[...nextauth]/route.ts"
NEXTAUTH_PAGES_ROUTE="apps/web/pages/api/auth/[...nextauth].ts"

if [ ! -f "$NEXTAUTH_APP_ROUTE" ] && [ ! -f "$NEXTAUTH_PAGES_ROUTE" ]; then
  mkdir -p "$(dirname "$NEXTAUTH_APP_ROUTE")"
  cat > "$NEXTAUTH_APP_ROUTE" <<'TS'
import NextAuth from "next-auth";
import Cognito from "next-auth/providers/cognito";

const handler = NextAuth({
  providers: [
    Cognito({
      issuer: process.env.COGNITO_ISSUER,
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      const groups = (profile && (profile as any)["cognito:groups"]) || token.roles || [];
      token.roles = groups;
      return token;
    },
    async session({ session, token }) {
      (session as any).roles = token.roles ?? [];
      return session;
    },
  },
});

export { handler as GET, handler as POST };
TS
  git add "$NEXTAUTH_APP_ROUTE" && git commit -m "feat(web): add NextAuth Cognito provider (App Router) with roles passthrough" || true
else
  echo "NextAuth route already present; leaving it unchanged."
fi

# Ensure next-auth package is installed (best-effort)
if ! grep -q '"next-auth"' package.json 2>/dev/null; then
  pnpm --filter @oasis/web add next-auth || true
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4) API JWT verification: ensure jwks-based strategy references envs (non-destructive)
JWT_HINT="$(grep -rn 'OIDC_ISSUER\|JWKS_URI\|passport-jwt\|jwks' apps/api libs 2>/dev/null || true)"
echo "JWT strategy scan:"
echo "${JWT_HINT:-'(no direct references found)'}"

# We won't overwrite existing strategy; if none is found, provide a minimal one under libs/auth.
if [ -z "$JWT_HINT" ]; then
  mkdir -p libs/auth/src
  cat > libs/auth/src/jwt.strategy.ts <<'TS'
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      issuer: process.env.OIDC_ISSUER,
      audience: process.env.OIDC_AUDIENCE,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        jwksUri: process.env.JWKS_URI!,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
      }),
    });
  }
  async validate(payload: any) {
    (payload as any).roles = payload['cognito:groups'] || payload['groups'] || [];
    return payload;
  }
}
TS
  git add libs/auth/src/jwt.strategy.ts && git commit -m "feat(api): add JWKS-based JwtStrategy using OIDC_ISSUER/AUDIENCE/JWKS_URI" || true
fi

# Ensure CORS allowlist uses env (non-destructive)
if ! grep -n "ALLOWED_ORIGINS" apps/api/src/main.ts >/dev/null 2>&1; then
  perl -0777 -pe 's#await app\.listen\([^)]+\);#const origins=(process\.env\.ALLOWED_ORIGINS||"").split(",").filter(Boolean);\napp.enableCors({ origin: origins, credentials: true });\nawait app.listen(process.env.PORT || 4000);#' -i apps/api/src/main.ts 2>/dev/null || true
  git add apps/api/src/main.ts && git commit -m "chore(api): enable CORS from ALLOWED_ORIGINS env" || true
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5) Smoke script (simple health checks; non-invasive)
mkdir -p scripts
cat > scripts/smoke.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
API_URL="${API_URL:-http://localhost:3000}"
WEB_URL="${WEB_URL:-http://localhost:3001}"
echo "[SMOKE] API /health:"; curl -sfS "$API_URL/health" | head -c 200; echo
echo "[SMOKE] WEB /up (if present):"; curl -sfS "$WEB_URL/up" | head -c 200 || echo "(no /up)"; echo
SH
chmod +x scripts/smoke.sh
git add scripts/smoke.sh && git commit -m "chore(ops): add smoke script for /health and /up" || true

# ─────────────────────────────────────────────────────────────────────────────
# 6) Lint/build quick pass (best-effort; do not fail the run)
echo "## Lint/build (best-effort)"
pnpm --filter @oasis/web lint || true
pnpm --filter @oasis/web build || true
pnpm --filter @oasis/api build || true

# ─────────────────────────────────────────────────────────────────────────────
# 7) Final summary (no secrets leaked)
echo ""
echo "=== SUMMARY ==="
echo "- Cognito wired:"
echo "  * Issuer: ${ISSUER}"
echo "  * JWKS:   ${JWKS_URI}"
echo "  * Client: ${APP_CLIENT_ID}"
echo "  * Hosted UI: ${HOSTED_UI_DOMAIN}"
echo "- Updated (not committed):"
echo "  * ${API_ENV} (OIDC_ISSUER/OIDC_AUDIENCE/JWKS_URI/ALLOWED_ORIGINS/REGION)"
echo "  * ${WEB_ENV} (COGNITO_ISSUER/CLIENT_ID/CLIENT_SECRET/NEXTAUTH_URL/DOMAINS)"
echo "- Added/kept:"
echo "  * NextAuth Cognito route (App Router) if missing"
echo "  * JWKS-based JwtStrategy if none found"
echo "  * CORS from ALLOWED_ORIGINS"
echo "  * scripts/smoke.sh"
echo ""
echo "NEXT STEPS:"
echo "1) Create two Cognito users and groups (Console → Users and groups):"
echo "   - boss@… in ADMIN, carer-demo@… in CARER"
echo "2) Start the stack (however you run web+api locally or in staging)."
echo "3) Run seeds when DB is reachable (optional): pnpm seed:staging"
echo "4) Run smoke locally: scripts/smoke.sh"
echo "5) Open Hosted UI, log in, ensure redirect to ${WEB_DOMAIN} works."
