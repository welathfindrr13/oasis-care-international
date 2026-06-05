# Oasis Care Deployment V2 Runbook

Deployment V2 is the cost-controlled, production-grade single-server foundation for Oasis Care. It replaces the previous AWS/ECS/Fargate/NAT/ALB staging direction with a lean production architecture that can run the full platform on one VPS-style server.

## Architecture

Services:

- `caddy`: public reverse proxy and HTTPS entrypoint.
- `web`: Next.js application on internal port `3000`.
- `api`: NestJS GraphQL/API application on internal port `4000`.
- `postgres`: private Postgres/pgvector database on internal port `5432`.

Public ports:

- `80`
- `443`

Persistent volumes:

- `postgres_data`
- `caddy_data`
- `caddy_config`

The database is not exposed publicly. Caddy is the only public listener.

## Server Assumptions

Use a VPS or single-server provider with:

- UK/EU region preference where possible.
- Provider DPA completed before real client data.
- Docker and Docker Compose installed.
- Firewall allowing inbound `80` and `443` only.
- SSH access restricted to trusted operators.
- Enough disk for Postgres data and local backup retention.

## Files

- `deploy/v2/docker-compose.yml`: service skeleton.
- `deploy/v2/Caddyfile`: reverse proxy routing.
- `deploy/v2/.env.example`: placeholder-only environment template.
- `deploy/v2/scripts/smoke-test.sh`: health and CareBridge boundary smoke checks.
- `deploy/v2/scripts/backup-postgres.sh`: local Postgres backup.
- `deploy/v2/scripts/restore-postgres.sh`: guarded restore procedure.

## Environment Setup

Copy the template on the server:

```bash
cp deploy/v2/.env.example deploy/v2/.env
```

Replace every `<...>` placeholder. Never commit `deploy/v2/.env`.

Run the env preflight before any VPS rehearsal:

```bash
pnpm deploy:v2:preflight -- deploy/v2/.env
```

The preflight must pass before any production-like runtime test. It fails on missing critical variables, placeholder values, localhost public URLs, local auth in production, demo mode in production, and obvious weak/default secrets.

Required areas:

- public domain and ACME email;
- Postgres database/user/password;
- `JWT_SECRET` and `NEXTAUTH_SECRET`;
- public app/API URLs, with GraphQL routed at `/graphql`;
- Clerk production auth provider values, including issuer, JWKS URL, public key, sign-in URL, and audience or authorized-party validation.

See `docs/deployment-v2/env-matrix.md` for the canonical variable matrix.

Known blocker: repo-side Deployment V2 config now expects Clerk, but the live Clerk dashboard, organization mapping, browser session flow, and authenticated staff/family/CareBridge QA are not complete. Do not use real client data until those checks pass.

## Startup Flow

Build and validate configuration:

```bash
docker compose -f deploy/v2/docker-compose.yml config
docker build -f apps/api/Dockerfile -t oasis-api:v2 .
docker build -f apps/web/Dockerfile -t oasis-web:v2 .
```

Start the stack only after replacing placeholders in `deploy/v2/.env`:

```bash
docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml up -d
```

Run migrations explicitly:

```bash
RUN_MIGRATIONS=true docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml up -d api
```

Then set `RUN_MIGRATIONS=false` for normal restarts.

## Smoke Test Flow

Unauthenticated smoke:

```bash
BASE_URL=https://your-domain.example deploy/v2/scripts/smoke-test.sh
```

Authenticated CareBridge smoke requires a chosen auth-provider flow or session cookies:

```bash
BASE_URL=https://your-domain.example \
FAMILY_COOKIE='<family-session-cookie>' \
STAFF_COOKIE='<staff-session-cookie>' \
deploy/v2/scripts/smoke-test.sh
```

Bearer tokens can also be supplied without printing secrets:

```bash
BASE_URL=https://your-domain.example \
STAFF_TEST_TOKEN='<staff-access-token>' \
FAMILY_TEST_TOKEN='<family-access-token>' \
deploy/v2/scripts/smoke-test.sh
```

The deployment is not healthy until CareBridge checks prove:

- family users remain in `/family` and family-safe surfaces;
- family users cannot access raw visits, care notes, medication records, care-planning internals, evidence packs, staff/admin/reporting data;
- staff review/approval surfaces do not leak into family navigation;
- published family updates remain approved projections, not raw operational records;
- medication visibility remains status-only by default: no names, no doses, no advice;
- concern cases remain scoped to the correct Care Room/contact;
- evidence exports remain staff-only unless a family-safe export is deliberately built later.

## Backup Flow

Create a timestamped local backup:

```bash
POSTGRES_USER=oasis POSTGRES_DB=oasis \
deploy/v2/scripts/backup-postgres.sh
```

Override backup location if needed:

```bash
POSTGRES_USER=oasis POSTGRES_DB=oasis \
BACKUP_DIR=/var/backups/oasis \
deploy/v2/scripts/backup-postgres.sh
```

If `deploy/v2/.env` exists, the script loads it automatically. Keep production backups outside the repo working tree.

Next production hardening step: encrypt and copy backups to an offsite UK/EU-compatible provider.

## Restore Flow

Restore requires an explicit backup file and confirmation:

```bash
deploy/v2/scripts/restore-postgres.sh /var/backups/oasis/oasis-oasis-YYYYMMDDTHHMMSSZ.dump
```

Non-interactive restore for rehearsals:

```bash
NON_INTERACTIVE=true deploy/v2/scripts/restore-postgres.sh /path/to/backup.dump
```

Run a restore rehearsal before real client data.

For non-interactive disposable rehearsals, explicitly confirm a pre-restore backup gate:

```bash
PRE_RESTORE_BACKUP_CONFIRMED=true \
NON_INTERACTIVE=true \
POSTGRES_USER=oasis \
POSTGRES_DB=oasis \
deploy/v2/scripts/restore-postgres.sh /path/to/backup.dump
```

Do not run restore against real client data until this has been rehearsed on disposable infrastructure.

## Observability And Incident Basics

Before launch, operators need:

- external uptime checks for `/login`, `/health`, and `/ready`;
- container log access for `caddy`, `web`, `api`, and `postgres`;
- disk-space alerting for the Postgres volume and backup directory;
- backup job success/failure alerting;
- API error reporting or log alerting for repeated `5xx` and auth failures;
- a documented first-response owner and breach escalation path;
- a pre-migration snapshot gate;
- rollback steps for application image/tag rollback and database restore;
- RTO/RPO targets decided by the business before real client data.

## GDPR And Care-Sector Pre-Live Gates

Before real client data:

- use UK/EU hosting where possible;
- complete provider DPA;
- complete DPIA/security review;
- require HTTPS;
- keep secrets out of git;
- verify backup and restore;
- preserve RBAC and CareBridge access boundaries;
- confirm audit logs are retained;
- document retention/deletion process;
- document incident/breach response basics.

## Old AWS/ECS Path

The old AWS/ECS/Fargate/NAT/ALB/Terraform path is obsolete for Deployment V2. Keep those files held for reference until Deployment V2 is fully reviewed; do not delete them without explicit approval.
