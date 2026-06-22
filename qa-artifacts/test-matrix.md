# Test Matrix

Last updated: 2026-06-22 20:26:49 BST

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

No live probes, deployments, SSH commands, migrations, or production-data actions were run.
