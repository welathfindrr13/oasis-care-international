# Production Gate 001

Oasis Care is merge-review ready, but CI green does not mean production ready. This gate tracks the repo-side work required before any real client data can be used on Deployment V2.

Deployment V2 means the cost-controlled, production-grade but not over-engineered single-server foundation: Docker Compose, Caddy HTTPS, web, API, Postgres, backups, smoke tests, and operational documentation. AWS is unavailable for this path and must not be used.

## Current Gate Status

| Area | Severity | Current evidence | Fixed by this gate | Remaining blocker |
| --- | --- | --- | --- | --- |
| Production auth provider | P0 | Web/API still expect Cognito-shaped production auth unless local dev mode is used. | Env preflight now fails if production auth config is missing or placeholder. | Choose and test the production provider; prove staff/family role and organisation claims. |
| Authenticated CareBridge boundary QA | P0 | Smoke script had unauthenticated route checks and family-cookie TODOs. | Smoke script now supports bearer/cookie staff and family probes with explicit skips when credentials are absent. | Run with real staff/family sessions after auth provider exists. |
| Real VPS runtime | P1 | Docker images, Compose config, and Caddy validation can pass locally. | Verification script collects the safe local gates in one place. | Run `docker compose up` on a disposable VPS with real domain/env. |
| Env/preflight safety | P1 | Deployment V2 env template existed, but placeholders could be missed. | Preflight validator fails on missing vars, placeholder values, unsafe localhost, local/demo auth in production, and weak obvious defaults. | Operator must run preflight against the real runtime env before any rehearsal. |
| Backup/restore proof | P0 | Backup and restore scripts existed but only local/offsite TODOs were documented. | Scripts now have stronger guards and restore warns about pre-restore backup and disposable rehearsal. | Prove encrypted offsite backup and restore drill before real data. |
| GDPR operating controls | P0 | Checklist documents DPA/DPIA/retention/erasure gaps. | Checklist now makes real-client-data blockers explicit for Deployment V2. | Complete DPA, DPIA, SAR/export/erasure/retention operating model. |
| Observability/incident response | P1 | Basic health endpoints and optional metrics exist. | Runbook documents uptime, logs, disk, backup alerting, rollback, RTO/RPO TODOs. | Choose monitoring/error reporting and prove alert paths. |
| No-AWS core runtime | P1 | AI summary code imported Bedrock and constructed a client at service construction. | AI summary generation is feature-flagged and Bedrock client creation is lazy. | AI remains disabled until a supported provider/model decision exists. |

## Launch Gates For Real Client Data

Real client data is blocked until all of these are complete and evidenced:

- Production auth provider selected, configured, and tested with staff/admin/family users.
- Authenticated CareBridge smoke passes with staff and family credentials/tokens.
- Family users cannot access raw visits, care notes, medication rows, care-planning internals, evidence packs, staff/admin/reporting data, or approval queues.
- Medication visibility for family remains status-only by default: no names, no doses, no advice.
- HTTPS works on the real domain and cookies/session behavior is verified through the browser.
- Deployment V2 env preflight passes against the real server env.
- Database backup and restore are rehearsed on disposable infrastructure.
- Encrypted/offsite backup provider and retention are chosen.
- Provider DPA is completed and retained.
- DPIA/security checklist is completed.
- SAR/export/erasure/retention/legal-hold operating model is documented.
- Audit logs are verified in the deployed runtime and retention is decided.
- Incident owner, breach response, rollback, and migration snapshot gates are documented.

## Commands

Run the safe local gate before any deployment rehearsal:

```bash
pnpm deploy:v2:preflight -- deploy/v2/.env
pnpm deploy:v2:verify
```

If any check is skipped because credentials, provider decisions, Docker, or real infrastructure are unavailable, that skip is not a pass. Record it as a blocker before handling real client data.
