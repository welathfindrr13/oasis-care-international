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
- `deploy/v2/scripts/backup-postgres.sh`: authenticated encrypted Postgres backup.
- `deploy/v2/scripts/restore-postgres.sh`: guarded encrypted restore procedure.
- `deploy/v2/scripts/rehearse-backup-restore.sh`: disposable restore, query, and destruction proof.
- `docs/deployment-v2/https-domain-cookie-proof.md`: Issue #11 HTTPS, domain, cookie, CORS, and Clerk callback proof runbook.

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

Known blocker: Clerk auth foundation and synthetic CareBridge QA are complete, but Issue #11 HTTPS/domain/cookie proof is still open. Do not use real client data until the public domain, TLS, secure cookie, Clerk callback/logout, and CORS checks in `docs/deployment-v2/https-domain-cookie-proof.md` pass.

## Startup Flow

Build and validate configuration:

```bash
docker compose -f deploy/v2/docker-compose.yml config
docker build -f apps/api/Dockerfile -t oasis-api:v2 .
docker build --build-arg "NEXT_PUBLIC_CLERK_CSP_ORIGINS=${NEXT_PUBLIC_CLERK_CSP_ORIGINS:?NEXT_PUBLIC_CLERK_CSP_ORIGINS is required}" -f apps/web/Dockerfile -t oasis-web:v2 .
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

Smoke tests verify TLS by default. `ALLOW_INSECURE_TLS=1` is available only for local/debug certificate troubleshooting and is not valid Issue #11 evidence.

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

## One-Time Legacy Bootstrap (Design-Gated Only)

The currently running deployment predates revision-aware health proof and is classified only as
`LEGACY_UNKNOWN`. The `Deploy VPS` workflow therefore exposes two narrowly scoped operations:

- `bootstrap_deploy` — one code-only transition from `LEGACY_UNKNOWN` to an exact reviewed SHA;
- `legacy_rollback` — an explicit image-based return to the preserved legacy containers.

This workflow is not a general deployment lane. No deploy SHA is approved by this documentation,
by the workflow implementation, or by merging its pull request. Execution needs a separate explicit
approval after every prerequisite below has been proven.

### Required operator inputs

- `target_sha`: the exact lowercase 40-character reviewed commit;
- `production_code_approval`:
  - `APPROVE_ONE_TIME_LEGACY_BOOTSTRAP_<target_sha>` for `bootstrap_deploy`;
  - `APPROVE_EXPLICIT_LEGACY_ROLLBACK_<target_sha>` for `legacy_rollback`.

Bootstrap requires the target to equal both the workflow revision and the then-current `origin/main`
tip. Rollback requires the stored target to remain a commit on `origin/main`; it never treats a Git
commit as proof of the legacy container revision.

### Permanent state and recovery contract

The only allowed state transitions are:

```text
ABSENT -> PREPARED -> MUTATION_STARTED -> REVISION_AWARE_COMPLETE
                         |                         |
                         +-> ROLLBACK_REQUIRED <---+
                                   |
                                   +-> LEGACY_ROLLED_BACK
```

`PREPARED` contains a permanent reservation plus the three validated running image IDs and derived
rollback aliases for API, web, and Caddy. The recorded legacy revision is always
`LEGACY_UNKNOWN`; there is no legacy rollback SHA. State is stored beneath Git common metadata with
restrictive permissions, exclusive transition locks, atomic same-directory writes, file and directory
sync, and fail-closed crash handling.

Before any Git checkout, image build, or running-service change, the workflow must:

1. reclassify API `/health`, web `/api/health`, and `/ready` as `LEGACY_UNKNOWN` with a healthy database;
2. prove the production target marker and acquire the host-local production mutation lock;
3. prove clean repository state and the reviewed `origin/main` target without printing repository details;
4. require exactly one healthy Compose-managed API, web, Caddy, and Postgres container;
5. preserve and re-inspect API, web, and Caddy image aliases;
6. durably commit `PREPARED`.

The workflow then checks out the exact target detached, runs configuration preflight, and sets
`MUTATION_STARTED` before building only API and web. A partial build therefore enters the explicit
`ROLLBACK_REQUIRED` path even though running containers have not yet changed. Runtime mutation recreates only API, web, and Caddy with
`--no-deps`, `--no-build`, `--pull never`, and `RUN_MIGRATIONS=false`. It never invokes a migration,
backfill, database restore, or database service mutation.

Completion requires all of the following without printing response bodies or diagnostics:

- API `/health` reports the exact target SHA;
- web `/api/health` reports the exact target SHA;
- `/ready` reports the exact target SHA, `ready`, and database `ok`;
- `REVISION_AWARE_COMPLETE` and the permanent completion marker are durably stored.

The reservation is never removed. Once created, future `LEGACY_UNKNOWN` bootstrap attempts fail closed.
If any failure occurs after `MUTATION_STARTED`, the workflow records `ROLLBACK_REQUIRED` and stops. It
never rolls back automatically.

`legacy_rollback` requires its distinct approval token, matching stored target, intact aliases, and
explicit operator dispatch. It recreates only API, web, and Caddy from the preserved images with
`--no-build`, `--pull never`, `--no-deps`, `RUN_MIGRATIONS=false`, and revision values explicitly set to
`unknown`. Success requires the running image IDs to match the preserved IDs, public health to classify
as `LEGACY_UNKNOWN`, database readiness to remain healthy, and state to become `LEGACY_ROLLED_BACK`.
The permanent reservation and any completion marker remain. Forward recovery after rollback requires a
new design and explicit approval; the exception cannot be reused.

### External execution blockers

These controls cannot be solved or truthfully proven by repository code:

- a protected production environment must exist with main-only policy and required human approval;
- old repository-scoped deploy credentials must be removed or invalidated outside this workflow;
- production transport values must exist only in the protected production environment;
- remote Git cleanliness, required CLI capabilities, durable storage, disk capacity, healthy containers,
  and preserved-image compatibility must pass sanitized execution-time checks;
- current public health must still be exactly `LEGACY_UNKNOWN` immediately before mutation;
- backup and restore evidence, migration status, UX proof, named staffing, and the complete fake-data
  smoke matrix remain unresolved Phase 7 gates.

If any prerequisite cannot be proven without exposing values, the result remains `NO-GO`. Merging this
workflow does not authorize dispatch, approve a target SHA, or make the application deploy-ready.

## Backup Flow

Create a private 256-bit key once and store it separately from the backup. The
key file must remain a regular `0600` file and must never be committed:

```bash
umask 077
install -d -m 0700 /etc/oasis
openssl rand -hex 32 > /etc/oasis/oasis-backup.key
chmod 600 /etc/oasis/oasis-backup.key
```

Create a timestamped AES-256-GCM encrypted backup. No plaintext dump is written
to disk:

```bash
POSTGRES_USER=oasis POSTGRES_DB=oasis \
BACKUP_ENCRYPTION_KEY_FILE=/etc/oasis/oasis-backup.key \
deploy/v2/scripts/backup-postgres.sh
```

Override backup location if needed:

```bash
POSTGRES_USER=oasis POSTGRES_DB=oasis \
BACKUP_DIR=/var/backups/oasis \
BACKUP_ENCRYPTION_KEY_FILE=/etc/oasis/oasis-backup.key \
deploy/v2/scripts/backup-postgres.sh
```

If `deploy/v2/.env` exists, the script loads the database name and user only.
The encryption key path is always explicit. Keep encrypted production backups
outside the repo working tree and keep the key in a separate operator-controlled
location. Selecting or paying for an offsite UK/EU-compatible provider remains
an external operator decision.

## Restore Flow

Restore requires an explicit backup file and confirmation:

```bash
PRE_RESTORE_BACKUP_CONFIRMED=true \
BACKUP_ENCRYPTION_KEY_FILE=/etc/oasis/oasis-backup.key \
deploy/v2/scripts/restore-postgres.sh /var/backups/oasis/oasis-oasis-YYYYMMDDTHHMMSSZ.dump.enc
```

Before confirmation, the restore command authenticates and copies the selected
encrypted archive into a private restore session and prints its SHA-256. The
long-lived key is never copied; final decryption reads it once into memory. The
transactional restore uses the pinned archive, so replacing the original archive
path cannot change the confirmed restore input, while a changed key fails closed.
Raw restore diagnostics are suppressed because database errors can contain row
values; the command returns only allowlisted status markers.

For a non-interactive restore, explicitly confirm the pre-restore backup gate:

```bash
PRE_RESTORE_BACKUP_CONFIRMED=true \
NON_INTERACTIVE=true \
POSTGRES_USER=oasis \
POSTGRES_DB=oasis \
BACKUP_ENCRYPTION_KEY_FILE=/etc/oasis/oasis-backup.key \
deploy/v2/scripts/restore-postgres.sh /path/to/backup.dump.enc
```

Before any production restore, prove the selected encrypted archive against a
new disposable Postgres container. This command authenticates the archive,
restores it, checks required schema objects, and destroys the container:

```bash
BACKUP_ENCRYPTION_KEY_FILE=/etc/oasis/oasis-backup.key \
deploy/v2/scripts/rehearse-backup-restore.sh /retrieved/offsite/backup.dump.enc
```

Only five allowlisted proof markers are printed. Raw database contents,
credentials, container details, and diagnostics remain suppressed. Do not run a
production restore until this rehearsal passes and a separate explicit recovery
decision has been made.

The rehearsal uses the digest-pinned Postgres image recorded in the script,
disables container networking, keeps PostgreSQL data on a bounded tmpfs, checks
that applied migration rows were recovered, disables persistent container logs,
discards raw restore diagnostics, and verifies container destruction.
CI also creates a synthetic migrated database and exercises this complete backup,
restore, query, and destruction path against real PostgreSQL and Docker.

For the controlled production gate, use the protected `Production Backup Restore
Proof` workflow. It requires the exact currently deployed production SHA and an
approval token binding that live SHA to the exact reviewed workflow/helper commit:
`APPROVE_PRODUCTION_BACKUP_RESTORE_PROOF_<live-sha>_WITH_<proof-commit-sha>`.
The workflow serializes with other production mutations, verifies the production
marker, live repository SHA, repository cleanliness, and healthy Postgres before
creating an archive.

The workflow transfers only reviewed backup helpers, verifies their SHA-256
manifest on the server, and creates or reuses a private root-owned encryption key.
The durable key never leaves the production trust boundary. The encrypted archive
is restored into a network-isolated tmpfs-backed disposable Postgres container on
the production host, queried through the bounded schema proof, and destroyed. Only
after that succeeds does the workflow retrieve the encrypted archive and checksum
into a private ephemeral runner directory to prove off-host retrieval integrity.
Those runner copies are destroyed before the proof can pass and are never uploaded
as workflow artifacts. Raw database, transport, Docker, and restore diagnostics
remain suppressed.

This gate requires a root-owned `0600` controlled-data marker containing exactly
`synthetic-only`; it refuses to retrieve an archive without that classification.
It uses the same host mutation lock as deployment, requires capacity for twice the
reported database size plus one GiB, and retains at most the latest and previous
verified archives. It may create the private production backup key, but it never
deploys code, runs migrations, restores production, or changes application records.
A separate operator-controlled copy of the key and encrypted archive is still
required before real client data. The controlled fake-data canary does not satisfy
that later real-data retention decision.

Provider-level droplet backups complement this database archive; they do not
replace it. Confirm the provider policy and a current private backup image before
launch. Restoring a provider image is a separate, explicitly approved recovery
exercise because it may create billable infrastructure.

## Observability And Incident Basics

`production-signals.mjs` is the bounded production probe. It checks that the
public login route returns the expected Oasis HTML, API/web/readiness revision
agreement, all required container health plus restart/OOM state, in-container
Postgres and host backup disk pressure, the authenticated creation time and tag
of the newest encrypted database backup, and real critical API/web/Caddy formats
from both log streams. It never prints URLs, container identifiers, log lines,
backup names, or database data.

Run it with the exact deployed SHA and explicit private backup key:

```bash
TARGET_SHA=<lowercase-40-character-reviewed-sha> \
OASIS_PRODUCTION_APP_URL=https://care.example.org \
BACKUP_ENCRYPTION_KEY_FILE=/etc/oasis/oasis-backup.key \
node deploy/v2/scripts/production-signals.mjs
```

The default thresholds are 85% disk use, a 26-hour maximum encrypted-backup age,
a 15-minute critical-log window, and 25 authentication/authorization denials in
that window. Override them only with reviewed operational values using
`DISK_MAX_PERCENT`, `BACKUP_MAX_AGE_HOURS`, `CRITICAL_LOG_SINCE`, and
`AUTH_DENIAL_THRESHOLD`.

New backups use the `OASISB2` envelope, which authenticates creation time with
the archive contents. Older `OASISB1` archives remain restorable, but cannot pass
the freshness signal because filesystem timestamps are mutable. Create and prove
a new encrypted backup before enabling the production gate.

Every failure marker has one owner and one immediate action:

| Failure marker | Owner | Immediate action |
| --- | --- | --- |
| `PRODUCTION_SIGNAL_PUBLIC_UPTIME_FAILED` | Platform operator | Confirm public routing and Caddy health; use explicit application rollback only for an availability failure after deployment. |
| `PRODUCTION_SIGNAL_REVISION_FAILED` | Platform operator | Stop deployment/canary and compare API, web, readiness, and approved SHA before any further mutation. |
| `PRODUCTION_SIGNAL_SERVICE_HEALTH_FAILED` | Platform operator | Inspect only the affected container's sanitized health/log metadata; do not run database restore automatically. |
| `PRODUCTION_SIGNAL_DISK_FAILED` | Platform operator | Stop writes/deployment where safe, identify Postgres or backup pressure, and expand/clean storage only through an approved operational action. |
| `PRODUCTION_SIGNAL_BACKUP_FAILED` | Platform operator | Stop migration/deployment, create or retrieve a fresh encrypted backup, then repeat disposable restore proof. |
| `PRODUCTION_SIGNAL_CRITICAL_ERRORS_FAILED` | Platform operator | Stop the canary, inspect redacted application diagnostics, and classify availability versus security containment before rollback. |
| `PRODUCTION_SIGNAL_AUTH_ABUSE_FAILED` | Platform operator | Stop the canary, preserve sanitized counts/timing, and investigate Clerk/JWT abuse or route probing without printing identities or tokens. |
| `PRODUCTION_SIGNAL_TIMEOUT_FAILED` | Platform operator | Stop the gate, confirm the missing heartbeat, and inspect Docker/filesystem responsiveness before retrying; do not bypass the watchdog. |
| `PRODUCTION_SIGNAL_CONFIGURATION_FAILED` | Platform operator | Correct only the missing/unsafe probe input; do not weaken thresholds, file permissions, TLS, or revision checks. |
| `PRODUCTION_SIGNAL_INTERNAL_FAILED` | Platform operator | Treat probe state as unknown and stop the production gate until the probe itself is reviewed. |

The probe is an executable gate, not a generalized monitoring platform. Before
the controlled canary, wire this exact command to the approved host scheduler or
monitoring runner and route any non-zero exit or missing completion heartbeat
after two minutes to the platform operator. Each subprocess has a ten-second
deadline and the complete probe is killed after two minutes. The external
scheduling action must not expose the key or raw command output.

The repository-owned systemd scheduler uses the existing production VPS and
does not create another server, storage product, or monitoring subscription.
Install it only after the server is running the exact reviewed main SHA, the
new `OASISB2` backup has passed disposable restore proof, and the first
production signal probe succeeds. The approved production transport must first
stage the reviewed installer itself at the root-owned
`/usr/local/sbin/oasis-install-production-signal-scheduler` path. Do not
execute an installer directly from the mutable deploy checkout. Then run:

```bash
sudo TARGET_SHA=<exact-reviewed-main-sha> \
  OASIS_PRODUCTION_APP_URL=https://care.example.org \
  BACKUP_ENCRYPTION_KEY_FILE=/etc/oasis/oasis-backup.key \
  /usr/local/sbin/oasis-install-production-signal-scheduler
```

The installer validates the exact local revision against `origin/main`,
private `0600` environment/key inputs, unit syntax, and one successful probe
before enabling the persistent five-minute calendar timer. It disables an
existing timer before replacement and leaves it disabled if the replacement
cannot prove a fresh success. Runtime JavaScript, helpers, Compose definition,
and unit files are read from the approved Git object and installed beneath a
root-owned, revision-specific `/usr/local/lib/oasis-production-signals`
directory; the timer never executes code from `/opt/oasis-care`. The service
has a 150-second outer deadline around a 130-second child deadline and writes
only a private, atomic, revision-bound heartbeat beneath
`/var/lib/oasis-production-signals`.

An independent runner must execute the following read-only check often enough
to alert within the reviewed window:

```bash
sudo /usr/local/sbin/oasis-verify-production-signal-scheduler
```

The check emits only `PRODUCTION_SIGNAL_HEARTBEAT_OK` or
`PRODUCTION_SIGNAL_HEARTBEAT_FAILED`. It fails if the timer is disabled or
inactive, the latest systemd service result failed, the heartbeat belongs to
another revision, or the last successful completion is more than seven minutes
and 15 seconds old. That window is the five-minute interval plus the probe's
two-minute completion deadline and a bounded publication margin.
The external runner and its operator notification destination remain a
separate production configuration choice; do not claim missing-heartbeat
alerting is live until that independent check has been observed to alert.

Before real client data, the business must also decide RTO/RPO targets and retain
an incident log covering time, impact, containment, and follow-up.

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
