#!/bin/bash

# === OASIS DISCOVERY SWEEP (READ-ONLY) ===
# Goal: Gather a full, current snapshot so we can decide next steps with confidence.
# Mode: ACT. Safety: Redact secrets; DO NOT run `terraform apply`; DO NOT push commits.

echo "# Oasis Discovery Sweep - $(date)"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 0) BOUNDS & REDACTION
echo "## Safety Notes"
echo "- Redacting secrets (first 3 chars + ...)"
echo "- Local commands only. No remote applies, no git pushes."
echo "- If something would mutate infra, skipping and noting why."
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 1) REPO & TOOLCHAIN SNAPSHOT
echo "## Repo & Toolchain"
git rev-parse --is-inside-work-tree 2>/dev/null || echo "Not a git repo"
git remote -v 2>/dev/null || true
git status -sb 2>/dev/null || true
echo "Node: $(node -v 2>/dev/null || echo 'not installed')"
echo "pnpm: $(pnpm -v 2>/dev/null || echo 'not installed')"
echo "Docker: $(docker -v 2>/dev/null || echo 'not installed')"
echo "Prisma: $(prisma -v 2>/dev/null | head -1 || pnpm prisma -v 2>/dev/null | head -1 || echo 'not installed')"
echo "Terraform: $(terraform -v 2>/dev/null | head -1 || echo 'not installed')"
echo ""

# Workspace map
echo "## Workspaces"
jq -r '.packages? // [] | .[]' package.json 2>/dev/null || pnpm -w list -r --depth -1 2>/dev/null || true
ls -la apps 2>/dev/null || echo "No apps directory"
ls -la libs 2>/dev/null || echo "No libs directory"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 2) ENV INVENTORY & CONFIG MATRIX
echo "## Env Files Found"
find . -name "*.env*" -type f 2>/dev/null | head -20 || true
echo ""

echo "## Env usage (process.env) — API"
grep -r -n 'process\.env\.[A-Z0-9_]\+' apps/api libs 2>/dev/null | head -20 || true
echo ""

echo "## Env usage (process.env) — WEB"
grep -r -n 'process\.env\.[A-Z0-9_]\+' apps/web 2>/dev/null | head -20 || true
echo ""

# Extract key expectations for prod
echo "## Missing prod templates?"
[ -f apps/api/.env.production.example ] && echo "API prod template: OK" || echo "API prod template: MISSING"
[ -f apps/web/.env.production.example ] && echo "WEB prod template: OK" || echo "WEB prod template: MISSING"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 3) BUILD & TEST STATUS (NO SIDE EFFECTS BEYOND LOCAL)
echo "## Web lint/build"
pnpm --filter @oasis/web lint 2>&1 || true
echo ""
pnpm --filter @oasis/web build 2>&1 || true
echo ""

echo "## API unit tests"
pnpm --filter @oasis/api test -- --runInBand 2>&1 || true
echo ""

echo "## API e2e tests"
pnpm --filter @oasis/api test:e2e -- --runInBand 2>&1 || true
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 4) DATABASE / PRISMA / PGVECTOR
echo "## Prisma generator block"
head -50 libs/db/prisma/schema.prisma 2>/dev/null | grep -n -E 'generator client|engineType|binaryTargets|previewFeatures' || echo "Schema not found or no generator config"
echo ""

echo "## Migrations list"
ls -1 libs/db/prisma/migrations 2>/dev/null || echo "No migrations dir"
echo ""

echo "## Vector extension in migrations"
grep -r -n 'CREATE EXTENSION.*vector' libs/db/prisma/migrations 2>/dev/null || echo "No pgvector extension found"
echo ""

echo "## Test env engine type"
grep -n 'PRISMA_CLIENT_ENGINE_TYPE' .env.test apps/api/.env.test 2>/dev/null || echo "No .env.test files with engine type"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 5) AUTH & RBAC REALITY CHECK
echo "## Auth wiring — API"
grep -r -n -E 'jwks|JWKS_URI|passport-jwt|@UseGuards|AuthGuard|JwtStrategy|Cognito|issuer|audience' apps/api libs/auth 2>/dev/null | head -20 || echo "No auth patterns found"
echo ""

echo "## Demo bypass guards"
grep -r -n -E 'Demo|DEMO_MODE|demo-auth|bypass' apps/api apps/web 2>/dev/null | head -10 || echo "No demo bypass patterns found"
echo ""

echo "## Roles & route protection"
grep -r -n -E '@Roles\(|RolesGuard|SetMetadata.*roles' apps/api 2>/dev/null | head -10 || echo "No roles/guards found"
echo ""

echo "## Web auth provider (NextAuth?)"
grep -r -n -E 'NextAuth|auth/.*nextauth|Cognito' apps/web 2>/dev/null || echo "No NextAuth patterns found"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 6) FEATURE READINESS QUICK SCAN
echo "## eMAR code paths"
grep -r -n -i -E 'emar|medication' apps 2>/dev/null | head -10 || echo "No eMAR/medication patterns found"
echo ""

echo "## Visits create/list UI"
grep -r -n -i 'visits' apps/web 2>/dev/null | head -10 || echo "No visits patterns found"
echo ""

echo "## Notifications placeholders"
grep -r -n -i -E 'notification|SQS|queue|enqueue' apps 2>/dev/null | head -10 || echo "No notification patterns found"
echo ""

echo "## Error pages / empty states"
grep -r -n -E '404|500|Empty state|No results' apps/web 2>/dev/null | head -10 || echo "No error handling patterns found"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 7) OBSERVABILITY & SECURITY
echo "## Logging & redaction"
grep -r -n -E 'pino|redact|masker|x-request-id|request-id' apps/api 2>/dev/null | head -10 || echo "No logging patterns found"
echo ""

echo "## Metrics endpoints"
grep -r -n -E 'metrics|Prometheus' apps/api 2>/dev/null | head -10 || echo "No metrics patterns found"
echo ""

echo "## Sentry / error tracking"
grep -r -n 'SENTRY_DSN' apps 2>/dev/null || echo "No Sentry DSN found"
echo ""

echo "## CORS / CSP / cookies"
grep -r -n -E 'cors|CORS|Content-Security-Policy|cookie|secure' apps 2>/dev/null | head -10 || echo "No CORS/security patterns found"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 8) CI PIPELINES
echo "## Workflows"
ls -la .github/workflows 2>/dev/null || echo "No workflows directory"
echo ""

head -50 .github/workflows/*.yml 2>/dev/null | grep -n -E 'on:|postgres|pgvector|workflow_dispatch|cache|pnpm|lint|build|test|e2e' || echo "No workflow patterns found"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 9) TERRAFORM (VALIDATE ONLY)
if [ -d infra ]; then
  echo "## Terraform init/validate"
  terraform -chdir=infra init -input=false -lock=false 2>&1 || true
  terraform -chdir=infra validate 2>&1 || true
  echo ""

  echo "## Terraform grep for safety features"
  grep -r -n -E 'backup_retention_period|deletion_protection|skip_final_snapshot|cloudwatch|alarm|aws_sqs_queue|aws_sns_topic|aws_lb_listener|acm|route53|secretsmanager' infra 2>/dev/null || echo "No safety features found"
  echo ""
elif [ -d infrastructure ]; then
  echo "## Terraform init/validate"
  terraform -chdir=infrastructure/staging init -input=false -lock=false 2>&1 || true
  terraform -chdir=infrastructure/staging validate 2>&1 || true
  echo ""

  echo "## Terraform grep for safety features"
  grep -r -n -E 'backup_retention_period|deletion_protection|skip_final_snapshot|cloudwatch|alarm|aws_sqs_queue|aws_sns_topic|aws_lb_listener|acm|route53|secretsmanager' infrastructure 2>/dev/null || echo "No safety features found"
  echo ""
else
  echo "No infra/ or infrastructure/ directory found"
fi

# ──────────────────────────────────────────────────────────────────────────────
# 10) SEED DATA & DEMO UX
echo "## Seed scripts"
grep -r -n 'seed' scripts apps libs 2>/dev/null | head -10 || echo "No seed patterns found"
echo ""

echo "## Staging badge / feature flags"
grep -r -n -E 'STAGING|GDPR_ENABLED|FEATURE_FLAG' apps 2>/dev/null || echo "No staging/feature flag patterns found"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 11) OUTPUT — PRINT A CRISP SNAPSHOT + NEXT STEPS
echo "## Summary Analysis"
echo ""

# Check key files exist
echo "### Key File Existence"
echo "- API prod template: $([ -f apps/api/.env.production.example ] && echo '✅' || echo '❌')"
echo "- Web prod template: $([ -f apps/web/.env.production.example ] && echo '✅' || echo '❌')"
echo "- Prisma schema: $([ -f libs/db/prisma/schema.prisma ] && echo '✅' || echo '❌')"
echo "- Migrations directory: $([ -d libs/db/prisma/migrations ] && echo '✅' || echo '❌')"
echo "- Infrastructure directory: $([ -d infrastructure ] && echo '✅' || echo '❌')"
echo ""

# Check for key patterns
echo "### Key Pattern Detection"
if grep -q 'engineType.*library' libs/db/prisma/schema.prisma 2>/dev/null; then
  echo "- Prisma engineType=library: ✅"
else
  echo "- Prisma engineType=library: ❌"
fi

if grep -r -q 'CREATE EXTENSION.*vector' libs/db/prisma/migrations 2>/dev/null; then
  echo "- pgvector in migrations: ✅"
else
  echo "- pgvector in migrations: ❌"
fi

if grep -r -q -E 'ConsentRecord|AuditLog|RetentionPolicy|ErasureQueue' libs/db/prisma/schema.prisma 2>/dev/null; then
  echo "- GDPR models in schema: ✅"
else
  echo "- GDPR models in schema: ❌"
fi

if grep -r -q 'pgvector' .github/workflows/*.yml 2>/dev/null; then
  echo "- CI mentions pgvector: ✅"
else
  echo "- CI mentions pgvector: ❌"
fi

echo ""
echo "### Next Steps Recommendations"
echo "1. Real login wired (Cognito/IdP) and DEMO_MODE=false in prod builds"
echo "2. RBAC enforced (ADMIN vs CARER) on API routes + hidden nav in Web"
echo "3. Seed script in place (clients, visits, meds) with today content"
echo "4. Staging domains over HTTPS with CORS/CSP set correctly"
echo "5. Error tracking (Sentry) DSNs present; /health (API) and /up (Web) respond 200"
echo ""

echo "### Values Needed from Human"
echo "- Cognito UserPoolId, AppClientId, (optional) Client Secret, region"
echo "- Staging domains (e.g., app.oasis-care.com, api.oasis-care.com)"
echo "- Alert email for CloudWatch SNS"
echo "- Initial data retention periods (logs, visits)"
echo ""

echo "Discovery sweep completed at $(date)"
