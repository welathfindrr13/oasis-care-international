# Test Matrix

Last updated: 2026-06-23 18:33:56 BST

| Area | Command | Status | Evidence |
| --- | --- | --- | --- |
| Deploy env tests | `node --test deploy/v2/scripts/preflight-env.test.mjs` | PASS | `qa-artifacts/logs/reconcile/20260622-targeted-preflight-env.log` |
| Compose tests | `node --test deploy/v2/docker-compose.test.mjs` | PASS | `qa-artifacts/logs/reconcile/20260622-targeted-docker-compose-test.log` |
| Release script tests | `node --test scripts/release/production-readiness-scripts.test.mjs` | PASS | `qa-artifacts/logs/reconcile/20260622-targeted-release-script-tests.log` |
| Bash syntax | `bash -n deploy/v2/scripts/verify-local.sh` | PASS | `qa-artifacts/logs/reconcile/20260622-targeted-verify-local-bash.log` |
| Bash syntax | `bash -n infrastructure/scripts/run-migration.sh` | PASS | `qa-artifacts/logs/reconcile/20260622-targeted-migration-bash.log` |
| Bash syntax | `bash -n scripts/diag/complete-diagnostic.sh` | PASS | `qa-artifacts/logs/reconcile/20260622-targeted-diag-bash.log` |
| Live probe helper syntax | `node --check scripts/release/probes/live-probe-env.mjs` | PASS | `qa-artifacts/logs/reconcile/20260622-targeted-live-probe-node-check.log` |
| Dependency check | `pnpm install --frozen-lockfile --ignore-scripts` | PASS | `qa-artifacts/logs/reconcile/20260622-full-pnpm-install.log` |
| Lint | `pnpm lint` | PASS | `qa-artifacts/logs/reconcile/20260622-full-pnpm-lint.log` |
| Test suite | `pnpm test` | PASS | `qa-artifacts/logs/reconcile/20260622-full-pnpm-test.log` |
| Build | `pnpm build` | PASS | `qa-artifacts/logs/reconcile/20260622-full-pnpm-build.log` |
| Prisma validate | `pnpm --dir libs/db exec prisma validate` | FAIL | Missing `DATABASE_URL` in clean worktree; `qa-artifacts/logs/reconcile/20260622-full-prisma-validate.log` |
| Prisma validate | `DATABASE_URL=<synthetic> pnpm --dir libs/db exec prisma validate` | PASS | `qa-artifacts/logs/reconcile/20260622-full-prisma-validate-synthetic.log` |
| Compose synthetic config | `docker compose --env-file deploy/v2/.env.synthetic -f deploy/v2/docker-compose.yml config` | PASS | `qa-artifacts/logs/reconcile/20260622-full-compose-synthetic.log` |
| Env preflight synthetic | `node deploy/v2/scripts/preflight-env.mjs deploy/v2/.env.synthetic` | PASS | `qa-artifacts/logs/reconcile/20260622-full-deploy-env-synthetic.log` |
| Compose required env | `env -i PATH="$PATH" HOME="$HOME" docker compose -f deploy/v2/docker-compose.yml config` | EXPECTED FAIL | `qa-artifacts/logs/reconcile/20260622-full-compose-requires-env.log` |
| Deploy V2 verify | `pnpm deploy:v2:verify` | FAIL THEN FIXED | Initial Caddy env-file issue; `qa-artifacts/logs/reconcile/20260622-full-deploy-v2-verify.log` |
| Deploy V2 verify | `pnpm deploy:v2:verify` | PASS | `qa-artifacts/logs/reconcile/20260622-full-deploy-v2-verify-rerun.log` |
| Shell syntax sweep | `find scripts infrastructure deploy -type f -name "*.sh" ... bash -n` | PASS | `qa-artifacts/logs/reconcile/20260622-full-shell-syntax.log` |
| Post-cleanup targeted tests | `node --test deploy/v2/scripts/preflight-env.test.mjs deploy/v2/docker-compose.test.mjs scripts/release/production-readiness-scripts.test.mjs` | PASS | `qa-artifacts/logs/reconcile/20260622-postcleanup-targeted-tests.log` |
| Post-cleanup diff check | `git diff --check` | PASS | `qa-artifacts/logs/reconcile/20260622-postcleanup-diff-check.log` |
| PR #34 review fixes diff check | `git diff --check` | PASS | `qa-artifacts/logs/pr34-review-fixes/diff-check.log` |
| PR #34 preflight tests | `node --test deploy/v2/scripts/preflight-env.test.mjs` | PASS | `qa-artifacts/logs/pr34-review-fixes/preflight-tests.log` |
| PR #34 compose tests | `node --test deploy/v2/docker-compose.test.mjs` | PASS | `qa-artifacts/logs/pr34-review-fixes/compose-tests.log` |
| PR #34 release script tests | `node --test scripts/release/production-readiness-scripts.test.mjs` | PASS | `qa-artifacts/logs/pr34-review-fixes/release-script-tests.log` |
| PR #34 workflow tests | `node --test .github/workflows/ci.test.mjs` | PASS | `qa-artifacts/logs/pr34-review-fixes/workflow-tests.log` |
| PR #34 Deploy V2 verify | `pnpm deploy:v2:verify` | PASS | `qa-artifacts/logs/pr34-review-fixes/deploy-v2-verify.log` |
| PR #34 install | `pnpm install --frozen-lockfile --ignore-scripts` | PASS | `qa-artifacts/logs/pr34-review-fixes/full-install.log` |
| PR #34 lint | `pnpm lint` | PASS | `qa-artifacts/logs/pr34-review-fixes/full-lint.log` |
| PR #34 tests | `pnpm test` | PASS | `qa-artifacts/logs/pr34-review-fixes/full-test.log` |
| PR #34 build | `pnpm build` | PASS | `qa-artifacts/logs/pr34-review-fixes/full-build.log` |
| PR #34 Prisma validate | `DATABASE_URL=<synthetic> pnpm --dir libs/db exec prisma validate` | PASS | `qa-artifacts/logs/pr34-review-fixes/prisma-validate.log` |
| PR #34 synthetic Compose | `docker compose --env-file deploy/v2/.env.synthetic -f deploy/v2/docker-compose.yml config` | PASS | `qa-artifacts/logs/pr34-review-fixes/synthetic-compose.log` |
| PR #34 Compose required env | missing required env Compose config | EXPECTED FAIL | `qa-artifacts/logs/pr34-review-fixes/required-env-compose-fail-fast.log` |
| PR #34 shell syntax sweep | `find deploy infrastructure scripts -name "*.sh" ... bash -n` | PASS | `qa-artifacts/logs/pr34-review-fixes/shell-syntax-sweep.log` |
| Staging VPS readonly baseline | `ssh oasis-staging "sudo -n /usr/local/bin/oasis-readonly"` | PASS | `qa-artifacts/staging-deploy-report.md` |
| Staging deploy env preflight | `node deploy/v2/scripts/preflight-env.mjs deploy/v2/.env` | PASS | `qa-artifacts/staging-deploy-report.md` |
| Staging deploy Compose config | `docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml config` | PASS | `qa-artifacts/staging-deploy-report.md` |
| Staging controlled Compose deploy | `docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml up -d --build --wait --wait-timeout 180` | PASS | `qa-artifacts/staging-deploy-report.md` |
| Staging public health | `/`, `/health`, `/ready`, `/sw.js`, `/api/health` | PASS | `qa-artifacts/staging-deploy-report.md` |
| Staging safe smoke | `/activity`, `/api/activity/today`, `/api/graphql` safe typename | PASS | `qa-artifacts/staging-deploy-report.md` |
| Issue #11 signed-out browser proof | `/family`, `/activity`, `/today`, `/carebridge`, `/family-updates/concerns` redirect to login | PASS | `qa-artifacts/authenticated-browser-proof.md` |
| Issue #11 public browser proof | `/`, `/health`, `/ready`, `/sw.js` | PASS | `qa-artifacts/authenticated-browser-proof.md` |
| Issue #11 unapproved CORS check | unapproved origin not allowed for `/api/health` and `/api/graphql` preflight | PASS | `qa-artifacts/authenticated-browser-proof.md` |
| Issue #11 admin browser proof | synthetic admin login and staff/admin routes | PARTIAL PASS | Routes rendered, but GraphQL console errors and audit-log FK failures observed |
| Issue #11 staff browser proof | synthetic staff login and staff routes | PARTIAL PASS | Routes rendered and session persisted, but GraphQL console errors observed; `/activity` stats returned 403 under admin-only policy |
| Issue #11 family browser proof | synthetic family login and family boundary routes | FAIL | Clerk rejected supplied synthetic family login |
| Issue #11 cookie/session proof | authenticated cookie attributes and session behavior | PARTIAL / BLOCKED | Staff reload persisted and URL did not expose tokens; cookie attributes not inspected |
| Issue #11 read-only auth diagnosis | code/config inspection, Chrome console, sanitized VPS logs | COMPLETE | Family failure is Clerk-account/setup blocked; `/activity` 403 is current role policy; audit-log FK failures likely explain authenticated console/log noise |
| Issue #11 audit-log FK regression RED | `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand` before source fix | EXPECTED FAIL | Stale org FK test failed because current interceptor attempted one write only |
| Issue #11 audit-log FK regression GREEN | `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand` | PASS | Valid org write and stale-org retry with nullable `organization_id` covered |
| Issue #11 auth guard regression | `pnpm --filter @oasis/api test -- src/auth/api-roles.guard.spec.ts --runInBand` | PASS | Clerk membership and tenant-role enforcement unchanged |
| Issue #11 JWT regression | `pnpm --filter @oasis/api test -- src/auth/jwt.strategy.spec.ts --runInBand` | PASS | Clerk issuer/org/role validation unchanged |
| Issue #11 affected API suite | `pnpm --filter @oasis/api test -- --runInBand` | PASS | 31 suites / 216 tests passed |
| Issue #11 local fix diff check | `git diff --check` | PASS | Whitespace check clean |
| Issue #11 local fix lint | `pnpm lint` | PASS | Repo configured lint task passed |
| Issue #11 local fix API build | `pnpm --filter @oasis/api build` | PASS | API compiled |
| Issue #11 local fix root build | `pnpm build` | PASS | 4 build tasks successful |

No migrations, production-data actions, live payment/email/SMS/fulfilment/order API calls, or production deploys were run.
