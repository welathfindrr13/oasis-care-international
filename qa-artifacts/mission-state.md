# Mission State

Last updated: 2026-07-01 19:50 BST

## Active Task

Issue #15 Phase 1 tenant nullability hardening: inventory nullable tenant-owned sensitive records, add runtime creation guards, add dry-run null-tenant count script, and document Phase 2 backfill/migration plan.

## Current Branch

- Branch: `codex/issue-15-null-tenant-phase1`
- Current main: `97d4dfc`
- Latest deployed staging commit recorded: `b67485a`
- Worktree: `/Users/tyreeseedwards/.codex/worktrees/issue-15-null-tenant-phase1/oasis-care`
- Original dirty branch preserved: `feat/staging-live-setup`

## Scope

Phase 1 only. No deploy, SSH, service restart, migration, Prisma migration, staging/production data mutation, env edit, Clerk user/session change, #41 closure, schema NOT NULL change, backfill, destructive database command, live payment/email/SMS/fulfilment/order API call, token/cookie/header/session inspection, or secret output was performed.

## Result

Phase 1 implementation is local only. Sensitive nullable tenant models are inventoried in `docs/tenant-nullability-phase1.md`. Runtime creation guards now reject missing/empty tenant ownership before creating new Carer, Client, Visit, CarerShift, MedicationAudit, Assessment, CarePlan, EvidencePack, CareLog, ConsentRecord, and ErasureQueue/SAR queue records through the audited API boundaries. Synthetic demo/seed paths now write Carer and Visit tenant ownership directly instead of creating null rows and patching later. `scripts/release/tenant-nullability-dry-run.mjs` reports sanitized null-tenant counts without row data and changes no data.

No migration was created. No backfill was performed. Issue #15 remains open for Phase 2 staging read-only counts, backfill/quarantine design, migration review, rehearsal, and approval.

## Pull Request

- PR: #37
- URL: https://github.com/welathfindrr13/oasis-care-international/pull/37
- Base: `main`
- Head: `graphql-proxy-clerk-db-jwt-fix`
- Status: merged / deployed to staging
- Base deployed staging commit: `c8dab7707ae5c58c36e8d8e4ef90270cfd4854fc`

## Verification

Issue #11 browser proof status: AUTH PROOF STILL FAILED / BLOCKED. PR #37 deployed successfully, and post-deploy admin shell proof passes for `/today` and `/carebridge`, but queue routes still have visible `Unauthorized`. No fresh `GraphQL errors: Array(1)` console entries were captured in the post-PR37 proof pass.

Evidence logs:

- `qa-artifacts/logs/reconcile/`
- `qa-artifacts/logs/pr34-review-fixes/`
- `qa-artifacts/staging-deploy-report.md`
- `qa-artifacts/authenticated-browser-proof.md`
- `qa-artifacts/screenshots/issue-11-auth-proof/`
- `qa-artifacts/defect-log.md`

Local fix verification:

- `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand`: PASS (9 tests after review changes)
- `pnpm --filter @oasis/api test -- src/auth/api-roles.guard.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- src/auth/jwt.strategy.spec.ts --runInBand`: PASS
- `pnpm --filter @oasis/api test -- --runInBand`: PASS
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/api build`: PASS
- `pnpm build`: PASS

CareBridge token propagation local verification:

- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (6 tests)
- `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (6 tests)
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/web build`: PASS
- `pnpm build`: PASS

PR #36 auth-boundary review-change verification:

- `pnpm exec tsx --test apps/web/lib/auth/clerk.test.ts`: PASS (14 tests)
- `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (6 tests)
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (6 tests)
- `git diff --check`: PASS
- `pnpm lint`: PASS
- `pnpm --filter @oasis/web build`: PASS
- `pnpm build`: PASS

PR #36 staging deploy and admin/staff proof:

- VPS fast-forward `687ee1e` -> `97678af`: PASS
- Deployment V2 real env preflight: PASS
- Compose config validation: PASS
- Controlled Compose deploy with `--wait`: PASS
- Post-deploy containers: web/api/caddy/postgres healthy
- Public checks `/`, `/health`, `/ready`, `/sw.js`, `/api/health`: PASS
- Safe `/api/graphql` `__typename`: PASS
- Signed-out `/activity` and `/api/activity/today`: PASS, 307 login redirects
- Admin `/carebridge`: PASS
- Admin `/carebridge/approvals`, `/carebridge/concerns`, `/family-updates/concerns`: FAIL, visible `Unauthorized` and `GraphQL errors: Array(1)`
- PR #36 deployed-content verification: PASS, deployed `97678af` contains central proxy/auth files and removed `useClerkClientQuery.ts`
- Admin queue error capture: PARTIAL / BLOCKED, active admin session reproduced failures but exact signed-in response body could not be intercepted; manual DevTools Network response capture is required
- Staff `/today`, `/family-updates`, `/carebridge`, `/activity`: PASS
- Staff reload/sign-out/session URL behavior: PASS / behavioral only

Local browser Clerk bearer fix:

- RED first: direct TSX tests failed before the source change because `clientQuery(...)` did not attach a Clerk bearer in the browser.
- `git diff --check`: PASS
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts`: PASS (4 tests)
- `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts`: PASS (14 tests)
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (6 tests)
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (6 tests)

PR #37 staging deploy:

- GitHub Actions `Deploy VPS` workflow run `28394084090`: PASS
- Deploy workflow head SHA: `c8dab7707ae5c58c36e8d8e4ef90270cfd4854fc`
- VPS read-only HEAD after deploy: `c8dab77`
- Containers after deploy: web/api/caddy/postgres healthy
- Public `/health`, `/ready`, `/sw.js`: PASS
- Signed-out `/today`: PASS, 307 login redirect
- Authenticated admin `/today`: PASS, `ADMIN` header, no visible `Unauthorized`, no fresh sanitized GraphQL console errors
- Authenticated admin `/carebridge`: PASS, `ADMIN` header, no visible `Unauthorized`, no fresh sanitized GraphQL console errors
- Authenticated admin `/carebridge/approvals`: FAIL, `ADMIN` header and page shell rendered, but visible `Unauthorized`; no fresh sanitized GraphQL console errors
- Authenticated admin `/carebridge/concerns`: FAIL, `ADMIN` header and page shell rendered, but visible `Unauthorized`; no fresh sanitized GraphQL console errors
- Authenticated admin `/family-updates/concerns`: FAIL, `ADMIN` header and page shell rendered, but visible `Unauthorized`; no fresh sanitized GraphQL console errors
- Sanitized Network response capture: BLOCKED, built-in browser plugin does not expose DevTools Network response bodies; read-only page evaluation exposes neither `fetch` nor `XMLHttpRequest`

Local Clerk readiness race fix:

- RED first: `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` failed because queue clients did not import `useAuth()`, gate on Clerk readiness, or pass `getBearerToken`.
- PR #38 review-change RED: focused tests failed against `ced0afb` because exported queue clients called `useAuth()` unconditionally and had no non-Clerk wrapper path.
- `git diff --check`: PASS
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts`: PASS (4 tests)
- `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts`: PASS (14 tests)
- `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts`: PASS (6 tests)
- `node --test apps/web/app/carebridge/carebridge-client-auth.test.js`: PASS (10 tests)
- `./node_modules/.bin/next lint` from `apps/web`: PASS
- `./node_modules/.bin/next build` from `apps/web`: PASS
- `corepack pnpm --filter @oasis/web build`: PASS

## Open Blockers

- Working synthetic family Clerk credentials/session are needed.
- PR #38 is merged to `main` as `059bde8`, but it is not deployed.
- PR #38 staging deploy rerun is blocked by the current approval gate: source/workflow proves `AUTH_IDENTITY_PROVIDER=clerk` enforcement, but only presence for `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER`; no sanctioned deploy-context equality boolean exists for both auth provider envs.
- Admin CareBridge approval/concern surfaces still show visible `Unauthorized` on deployed `c8dab77` until the merged PR #38 fix is deployed and proven.
- ApiRolesGuard order fix is not currently supported by source/test evidence.
- Exact post-PR37 signed-in GraphQL response body capture is blocked by current built-in browser tooling; only route DOM/console symptoms were captured after PR #37.
- Robust external Clerk org id to internal `organization.id` mapping remains a follow-up blocker; PR #35 only preserves audit events when mapping is stale/missing.
- Staff `/activity` expected behavior needs decision: safe forbidden state vs staff-authorized stats.
- Cookie attributes still need manual DevTools attribute confirmation if exact Secure/SameSite/HttpOnly/domain proof is required.
- Production readiness is not claimed.
- Rollback strategy follow-up remains deferred.

## Next Recommended Action

PR #38 was approved, marked ready, and squash-merged to `main` as `059bde8`. The first controlled staging deploy attempt stopped before deploy because a sanitized auth env preflight returned `NO` for both expected auth provider checks.

Read-only diagnosis showed the failed env preflight used the `oasis-staging` deploy alias as user `deploy`, which cannot read the root-owned `/opt/oasis-care/deploy/v2/.env` and cannot inspect Docker directly. The `NO` result therefore came from the wrong access context/source, not from proven non-Clerk runtime configuration. The GitHub Deploy VPS workflow remains the correct deploy lane: it runs `preflight-env.mjs deploy/v2/.env` before compose up, uses `docker compose --env-file deploy/v2/.env`, and does not print the env file. Compose passes `AUTH_IDENTITY_PROVIDER` to web/API runtime and `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER` to web build args/runtime.

The approved workflow deploy rerun was stopped before triggering the workflow because source inspection found the existing preflight enforces `AUTH_IDENTITY_PROVIDER=clerk` but only requires `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER` to be present. Existing workflow logs do not produce sanitized equality booleans for both auth provider envs. Under the current approval criteria, the deploy gate is not satisfied.

Focused local preflight hardening is now implemented but not pushed/deployed. It requires `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk` in `deploy/v2/scripts/preflight-env.mjs`, emits sanitized YES/NO auth-mode proof, and adds regression coverage. Verification passed for `git diff --check`, focused preflight tests, CI-equivalent Deployment V2 static gates, and workflow discovery. Full `pnpm deploy:v2:verify` remains locally blocked by dependency build-script approval gating.

Next safest action is review the local commit, push a focused draft PR, wait for CI/review, merge, then rerun the controlled staging deploy through the approved GitHub Deploy VPS workflow. Keep Issue #11 open. Do not proceed to production.

Can continue autonomously: NO - further diagnosis/fix/deploy boundaries require explicit approval.

## Issue #15 No-Deploy Eligible-Table Gate Workflow

Timestamp: 2026-07-03 12:06 BST

- Mode: local workflow/test change only
- Workflow added: `.github/workflows/tenant-nullability-dry-run.yml`
- Purpose: provide a sanctioned GitHub Actions lane for the staging eligible-table gate after the plain `oasis-staging` SSH alias failed to read the root-owned compose env file.
- Trigger: manual `workflow_dispatch`
- Command type: fixed API-container dry-run command only, using `tenant-nullability-dry-run.mjs --fail-on-null --exclude AuditLog`
- Safety controls:
  - no arbitrary workflow inputs
  - no deploy steps
  - no `git pull` / checkout of remote staging code
  - no `docker compose up`, build, restart, or service rebuild
  - no migration or backfill commands
  - no env file printing, DB URL printing, row data, names, emails, IDs, tokens, cookies, headers, JWTs, session values, or API keys
  - sanitized output allowlist for model/table/count lines, `Excluded models: AuditLog`, pass/fail, and `No data changed.`
- Verification:
  - `git diff --check`: PASS
  - `node --test .github/workflows/*.test.mjs`: PASS, 14 tests
  - `node --test scripts/release/tenant-nullability-dry-run.test.mjs`: PASS, 10 tests
- Deploy performed: NO
- Dry-run performed: NO
- Migration created: NO
- Backfill performed: NO
- Data changed: NO
- Next step: review/push PR, wait for CI, then trigger the workflow only after explicit approval.
