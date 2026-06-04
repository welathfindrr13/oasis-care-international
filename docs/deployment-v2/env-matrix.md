# Deployment V2 Environment Matrix

This matrix is generated from current code references and Deployment V2 templates. Values shown here are shapes only, never real secrets.

## Required Production Variables

| Variable | Service | Production required | Frontend exposed | Source in code/config | Example shape | Missing/unsafe behavior |
| --- | --- | --- | --- | --- | --- | --- |
| `APP_DOMAIN` | Caddy/shared | Yes | No | `deploy/v2/Caddyfile`, `deploy/v2/docker-compose.yml` | `care.example.com` | Preflight fails if missing or localhost. |
| `ACME_EMAIL` | Caddy | Yes | No | `deploy/v2/Caddyfile` | `ops@example.com` | Caddy falls back to placeholder email; preflight fails. |
| `POSTGRES_DB` | Postgres | Yes | No | `deploy/v2/docker-compose.yml` | `oasis` | Compose fallback exists but should be explicit. |
| `POSTGRES_USER` | Postgres | Yes | No | `deploy/v2/docker-compose.yml`, backup scripts | `oasis` | Compose fallback exists but should be explicit. |
| `POSTGRES_PASSWORD` | Postgres | Yes | No | `deploy/v2/docker-compose.yml` | strong random value | Preflight fails if missing, weak, or placeholder. |
| `DATABASE_URL` | API/db | Yes | No | `libs/db/prisma/schema.prisma`, `libs/db/src/prisma.service.ts`, API config | `postgresql://oasis:<secret>@postgres:5432/oasis` | API/db startup or first query fails. |
| `JWT_SECRET` | API | Yes | No | `apps/api/src/config/config.module.ts`, `libs/auth/src/jwt.strategy.ts` | 32+ char random secret | API config validation fails if missing/short. |
| `NEXTAUTH_SECRET` | Web/API proxy | Yes | No | web auth/proxy routes, Compose | 32+ char random secret | Sessions/proxy token extraction fail. |
| `NEXTAUTH_URL` | Web/auth | Yes | No | NextAuth config, Compose | `https://care.example.com` | Auth callbacks and cookies can fail; preflight blocks localhost. |
| `NEXT_PUBLIC_API_URL` | Web | Yes | Yes | web GraphQL clients and route proxy | `https://care.example.com/graphql` | Web routes proxy to wrong API; build may bake wrong public URL. |
| `NEXT_PUBLIC_SITE_URL` | Web | Yes | Yes | `apps/web/lib/url.ts`, Compose | `https://care.example.com` | Absolute app links may be wrong. |
| `ALLOWED_ORIGINS` | API | Yes | No | `apps/api/src/main.ts` | `https://care.example.com` | CORS may reject web or allow unsafe fallback. |
| `AUTH_IDENTITY_PROVIDER` | API/auth | Yes | No | `apps/api/src/auth/api-roles.guard.ts` | `cognito` | Org identity mapping uses default; preflight requires explicit value. |
| `COGNITO_ISSUER` | Web/API auth | Yes for current code | No | NextAuth and JWT strategy | `https://issuer.example.com/...` | Web/API auth initialization fails. |
| `COGNITO_CLIENT_ID` | Web/API auth | Yes for current code | No | NextAuth and JWT strategy | provider client id | Token validation fails or auth init fails. |
| `COGNITO_CLIENT_SECRET` | Web auth | Yes for current code | No | NextAuth provider | provider client secret | Sign-in fails. |
| `LOCAL_AUTH_ENABLED` | Web/API | Yes, must be `false` | No | local auth mode checks | `false` | Preflight fails if true in production. |
| `NEXT_PUBLIC_LOCAL_AUTH_ENABLED` | Web | Yes, must be `false` | Yes | login/local auth mode | `false` | Preflight fails if true in production. |
| `DEMO_MODE` | API | Yes, must be `false` or absent | No | demo seed guard, health | `false` | Preflight fails if true in production. |
| `RUN_MIGRATIONS` | API entrypoint | Yes, explicit | No | `apps/api/docker-entrypoint.sh`, Compose | `false` normally, `true` for controlled migration window | Avoids accidental DB mutation on restart. |

## Optional Or Feature-Flagged Variables

| Variable | Service | Required in production | Frontend exposed | Source | Notes |
| --- | --- | --- | --- | --- | --- |
| `GDPR_ENABLED` | API | No until GDPR module is ready | No | `apps/api/src/app.module.ts` | Real-client-data gates still apply even when false. |
| `METRICS_ENABLED` | API | No | No | `apps/api/src/app.module.ts`, metrics module | If true, `/metrics` is admin-guarded and should be monitored. |
| `AI_SUMMARY_ENABLED` | API | No | No | AI summary service | Must remain false for no-AWS Deployment V2 until provider/model is chosen. |
| `AWS_REGION` | API AI only | No for core runtime | No | AI summary service | Required only if AI summary generation is enabled. |
| `BEDROCK_MODEL` | API AI only | No for core runtime | No | AI summary service | Required only if AI summary generation is enabled. |
| `BEDROCK_MODEL_FALLBACKS` | API AI only | No | No | AI summary service | Optional comma-separated fallback model ids. |
| `JWT_JWKS_TIMEOUT_MS` | API auth | No | No | JWT strategy | Optional JWKS timeout override. |
| `COGNITO_LOGOUT_URL` | Web auth | No | No | logout route | Optional explicit logout URL. |
| `COGNITO_DOMAIN` | Web auth | No | No | logout route | Optional hosted UI domain. |
| `COGNITO_HOSTED_UI_DOMAIN` | Web auth | No | No | logout route | Optional hosted UI domain alias. |
| `COGNITO_LOGOUT_REDIRECT_URI` | Web auth | No | No | logout route | Optional post-logout redirect. |
| `APP_VERSION` / `VERSION` | API/web health | No | No | health endpoints | Useful for releases. |
| `APP_COMMIT_SHA` / `COMMIT_SHA` | API/web health | No | No | health endpoints | Useful for incident triage. |
| `APP_ENVIRONMENT` / `ENVIRONMENT` / `STAGE` | API/web health | No | No | health endpoints | Useful for dashboards. |
| `DEMO_SEED_TOKEN` | API demo only | No | No | demo seed controller | Never set with real client data. |
| `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` | API demo only | No | No | demo seed controller | Demo-only. |

## Production Auth Caveat

The current production implementation remains Cognito-shaped. If Oasis moves to a non-AWS OIDC provider, the provider decision must include code/config changes and fresh staff/family/CareBridge QA. Do not treat `AUTH_IDENTITY_PROVIDER` alone as proof of generic OIDC support.
