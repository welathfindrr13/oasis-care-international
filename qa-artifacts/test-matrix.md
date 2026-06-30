# Test Matrix

Last updated: 2026-06-29 16:54 BST

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
| Issue #11 read-only auth diagnosis | code/config inspection, Chrome console, sanitized VPS logs | COMPLETE | Family failure is Clerk-account/setup blocked; `/activity` 403 is current role policy; audit-log FK failures are confirmed audit defects but not proven as browser GraphQL console cause |
| Issue #11 audit-log FK regression RED | `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand` before source fix | EXPECTED FAIL | Stale org FK test failed because current interceptor attempted one write only |
| Issue #11 audit-log FK regression GREEN | `pnpm --filter @oasis/api test -- src/common/interceptors/__tests__/audit-log.interceptor.spec.ts --runInBand` | PASS | 9 tests cover valid org writes, supported Prisma FK meta shapes, negative scoping, nullable org input, retry failure logging, and response-path isolation |
| Issue #11 auth guard regression | `pnpm --filter @oasis/api test -- src/auth/api-roles.guard.spec.ts --runInBand` | PASS | Clerk membership and tenant-role enforcement unchanged |
| Issue #11 JWT regression | `pnpm --filter @oasis/api test -- src/auth/jwt.strategy.spec.ts --runInBand` | PASS | Clerk issuer/org/role validation unchanged |
| Issue #11 affected API suite | `pnpm --filter @oasis/api test -- --runInBand` | PASS | 31 suites / 216 tests passed |
| Issue #11 local fix diff check | `git diff --check` | PASS | Whitespace check clean |
| Issue #11 local fix lint | `pnpm lint` | PASS | Repo configured lint task passed |
| Issue #11 local fix API build | `pnpm --filter @oasis/api build` | PASS | API compiled |
| Issue #11 local fix root build | `pnpm build` | PASS | 4 build tasks successful |
| PR #35 merge CI | GitHub Actions `test`, `Deployment V2 verification` | PASS | PR #35 latest commit `96ffda1` passed before merge |
| PR #35 staging fast-forward | VPS `/opt/oasis-care` `git pull --ff-only origin main` | PASS | VPS moved `3ec66ec` -> `687ee1e` |
| PR #35 staging preflight | `node deploy/v2/scripts/preflight-env.mjs deploy/v2/.env` | PASS | No env values printed |
| PR #35 staging Compose config | `docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml config` | PASS | `compose-config-ok` |
| PR #35 staging controlled deploy | `docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml up -d --build --wait --wait-timeout 180` | PASS | web/api rebuilt and all containers healthy |
| PR #35 post-deploy health | `/`, `/health`, `/ready`, `/sw.js`, `/api/health`, safe GraphQL typename | PASS | All returned expected 200 responses |
| PR #35 signed-out protection | `/activity`, `/api/activity/today` | PASS | Both returned 307 login redirects |
| PR #35 admin proof rerun | admin `/today`, `/activity`, CareBridge routes | FAIL / BLOCKED | Routes rendered without 500/502 and header showed admin, but GraphQL console errors remain on CareBridge approval/concern surfaces |
| Admin CareBridge GraphQL diagnosis | fresh synthetic admin tabs for `/carebridge/approvals`, `/carebridge/concerns`, `/family-updates/concerns`, `/carebridge`; code/log inspection | COMPLETE | Approval/concern client pages show visible `Unauthorized` and fresh `GraphQL errors: Array(1)`; operations mapped to `VerifiedVisitStoryApprovalQueue`, `CareRooms`, and `CarebridgeConcernInbox`; likely client-side Clerk token propagation issue using plain `clientQuery(...)` instead of Clerk-aware helper |
| PR #35 staff proof rerun | staff `/today`, `/activity`, `/family-updates`, `/carebridge` | PARTIAL PASS | Staff routes rendered; `/activity` showed safe forbidden state; no GraphQL errors captured in fresh staff tab; final sign-out had session-state anomaly |
| PR #35 audit fallback post-deploy logs | sanitized API log sample | PARTIAL PASS | `P2003` still occurs, fallback logs `retrying without organization_id`; no sampled `Failed to write audit log` |
| CareBridge token propagation focused RED | `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` before wrapper/client implementation | EXPECTED FAIL | Test expected Clerk-aware client component files before they existed |
| CareBridge token propagation focused GREEN | `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` | PASS | 4 tests verify CareBridge approval/concern client components use Clerk-aware GraphQL helper and family aliases stay dynamic |
| CareBridge token propagation diff check | `git diff --check` | PASS | Whitespace check clean |
| CareBridge token propagation lint | `pnpm lint` | PASS | No ESLint warnings or errors after stable callback/hook dependency cleanup |
| CareBridge token propagation web build | `pnpm --filter @oasis/web build` | PASS | Direct CareBridge routes and family alias routes build as dynamic without Clerk prerender errors |
| CareBridge token propagation root build | `pnpm build` | PASS | 4 build tasks successful |
| PR #36 review-change CareBridge proxy static guard | `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` | PASS | 6 tests verify CareBridge uses shared `clientQuery`, `clientQuery` sends cookies, `/api/graphql` resolves auth centrally, and aliases remain intact |
| PR #36 review-change proxy token resolver | `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts` | PASS | 6 tests cover direct bearer priority, Clerk cookie token path, Clerk server-auth fallback, NextAuth token order, and missing auth |
| PR #36 review-change diff check | `git diff --check` | PASS | Whitespace check clean |
| PR #36 review-change lint | `pnpm lint` | PASS | No ESLint warnings or errors |
| PR #36 review-change web build | `pnpm --filter @oasis/web build` | PASS | Next web build completed; `/api/graphql` and CareBridge routes built |
| PR #36 review-change root build | `pnpm build` | PASS | 4 build tasks successful |
| PR #36 auth-boundary Clerk extractor tests | `pnpm exec tsx --test apps/web/lib/auth/clerk.test.ts` | PASS | 14 tests cover role/org claims plus exact/suffixed Clerk session cookies, deterministic precedence, malformed/empty/unrelated cookies, URL decoding, and invalid escapes |
| PR #36 auth-boundary proxy resolver tests | `pnpm exec tsx --test apps/web/lib/graphql/proxy-auth.test.ts` | PASS | 6 tests cover direct bearer priority, server Clerk token before cookie fallback, cookie fallback, non-Clerk token order, and missing auth |
| PR #36 auth-boundary CareBridge proxy static guard | `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` | PASS | 6 tests verify CareBridge uses shared `clientQuery`, `/api/graphql` central auth inputs, unauthorized path, token forwarding, no token/header logging, and aliases |
| PR #36 auth-boundary diff check | `git diff --check` | PASS | Whitespace check clean |
| PR #36 auth-boundary lint | `pnpm lint` | PASS | No ESLint warnings or errors |
| PR #36 auth-boundary web build | `pnpm --filter @oasis/web build` | PASS | Next web build completed |
| PR #36 auth-boundary root build | `pnpm build` | PASS | 4 build tasks successful |
| PR #36 staging fast-forward | VPS `/opt/oasis-care` `git pull --ff-only origin main` | PASS | VPS moved `687ee1e` -> `97678af`; known untracked deploy-local files preserved |
| PR #36 staging preflight | `node deploy/v2/scripts/preflight-env.mjs deploy/v2/.env` | PASS | No env values printed |
| PR #36 staging Compose config | `docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml config` | PASS | `compose-config-ok` |
| PR #36 staging controlled deploy | `docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml up -d --build --wait --wait-timeout 180` | PASS | web/api rebuilt and all containers healthy |
| PR #36 post-deploy public health | `/`, `/health`, `/ready`, `/sw.js`, `/api/health` | PASS | All returned 200 |
| PR #36 post-deploy safe GraphQL | `/api/graphql` safe `__typename` | PASS | Returned `{"data":{"__typename":"Query"}}` |
| PR #36 signed-out protection | `/activity`, `/api/activity/today` | PASS | Both returned 307 login redirects |
| PR #36 admin `/carebridge` proof | Chrome synthetic admin session | PASS | `ADMIN` header, fake active CareBridge rooms visible, no visible `Unauthorized`, no console errors |
| PR #36 admin CareBridge queue proof | Chrome synthetic admin session for `/carebridge/approvals`, `/carebridge/concerns`, `/family-updates/concerns` | FAIL | Visible `Unauthorized` and fresh `GraphQL errors: Array(1)` remain |
| PR #36 deployed content verification | Read-only SSH `git show` and file existence checks on staging `97678af` | PASS | Deployed squash commit includes central `/api/graphql` proxy/auth files, `proxy-auth` and Clerk extractor tests, and removed `useClerkClientQuery.ts`; missing-deploy hypothesis ruled out |
| PR #36 staff proof | Chrome synthetic staff session for `/today`, `/family-updates`, `/carebridge`, `/activity` | PASS | `CARER` header, routes rendered, no visible `Unauthorized`, no fresh GraphQL console errors, reload persisted session, sign-out returned to login |
| Admin CareBridge queue auth root-cause diagnosis | Code inspection, Chrome session check, read-only redacted VPS log tail | COMPLETE | Primary cause classified as API guard role assertion before Clerk tenant membership enrichment; no code changes or deploy performed |
| ApiRolesGuard order fix preflight | Direct Jest: `CI=true ./apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.config.js src/auth/api-roles.guard.spec.ts --runInBand` | PASS | 13 tests passed; current source already covers membership-derived admin/carer access after raw Clerk member role |
| JWT strategy adjacent guard check | Direct Jest: `CI=true ./apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.config.js src/auth/jwt.strategy.spec.ts --runInBand` | PASS | 17 tests passed; Clerk role mapping unchanged |
| ApiRolesGuard order fix decision | Source/test inspection | HALTED | Approved guard-order hypothesis did not reproduce in current `origin/main`; no source fix made |
| Admin queue exact GraphQL error capture | Chrome `/carebridge/approvals`, `/carebridge/concerns`, `/family-updates/concerns`; browser capability check; read-only VPS content check | PARTIAL / BLOCKED | Active admin session reproduced visible `Unauthorized` and fresh `GraphQL errors: Array(1)` on all three target routes. Exact signed-in response body could not be intercepted with available in-app/Chrome tooling. Previous no-cookie control is not signed-in evidence. Manual DevTools Network response capture is required |
| Signed-in admin GraphQL error body | Manual sanitized Chrome DevTools capture for `/carebridge/approvals` | COMPLETE | `/api/graphql` returned HTTP 200 GraphQL envelope with `errors[0].message = Unauthorized`, `extensions.code = UNAUTHENTICATED`, `data = null`; cookies present but values redacted; no Authorization header |
| Browser Clerk bearer split proof | Manual sanitized browser console probe | COMPLETE | Cookie-only `/api/graphql` returned GraphQL `UNAUTHENTICATED` with `data = null`; explicit `window.Clerk.session.getToken()` bearer returned object data and no GraphQL errors |
| Browser Clerk bearer client RED | `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts` before source fix | EXPECTED FAIL | `clientQuery(...)` did not send Authorization when browser Clerk session token was available |
| Browser Clerk bearer client GREEN | `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts` | PASS | 4 tests cover Clerk session bearer attachment, caller Authorization priority, no-Clerk/no-token fallback, and no token-value logging |
| Browser Clerk bearer extractor regression | `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts` | PASS | 14 tests cover role/org claims plus exact/suffixed Clerk session fallback behavior |
| Browser Clerk bearer proxy resolver regression | `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts` | PASS | 6 tests cover direct bearer priority, server Clerk token before cookie fallback, session cookie fallback, non-Clerk token order, and missing auth |
| CareBridge shared proxy static guard | `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` | PASS | 6 tests verify CareBridge remains on shared `clientQuery`, `/api/graphql` central auth inputs, unauthorized path, token forwarding, no token/header logging, and aliases |
| Browser Clerk bearer local diff check | `git diff --check` | PASS | Whitespace check clean |
| Browser Clerk bearer local web lint | `./node_modules/.bin/next lint` from `apps/web` | PASS | No ESLint warnings or errors |
| Browser Clerk bearer local web build | `./node_modules/.bin/next build` from `apps/web`; `corepack pnpm --filter @oasis/web build` | PASS | Next web build completed and `/api/graphql` route built |
| PR #37 merge CI | GitHub Actions `test`, `Deployment V2 verification` | PASS | PR #37 latest commit `e853b13` passed before squash merge |
| PR #37 staging deploy | GitHub Actions `Deploy VPS` workflow run `28394084090` | PASS | Workflow deployed `c8dab77` to staging; no migrations run |
| PR #37 VPS read-only post-deploy state | `ssh oasis-staging "sudo -n /usr/local/bin/oasis-readonly"` | PASS | VPS HEAD `c8dab77`; web/api/caddy/postgres healthy; only expected untracked deploy-local files present |
| PR #37 public smoke | `/health`, `/ready`, `/sw.js`, signed-out `/today` | PASS | Public endpoints returned 200; signed-out `/today` returned 307 login redirect |
| PR #37 admin shell proof rerun | In-app browser `/today`, `/carebridge` after manual fake-admin sign-in | PASS | Both routes rendered with `ADMIN`, no login redirect, no visible `Unauthorized`, and no fresh sanitized GraphQL console errors |
| PR #37 admin CareBridge queue proof rerun | In-app browser `/carebridge/approvals`, `/carebridge/concerns`, `/family-updates/concerns` after manual fake-admin sign-in | FAIL | Routes rendered with `ADMIN` and no login redirect, but all three showed visible `Unauthorized`; no fresh sanitized GraphQL console errors captured |
| PR #37 sanitized GraphQL response capture | Built-in browser response capture attempt for `/api/graphql` on failing queue routes | BLOCKED | Browser plugin does not expose DevTools Network response bodies; read-only page evaluation exposes neither `fetch` nor `XMLHttpRequest`; manual DevTools Network capture still required |
| Clerk readiness race CareBridge guard RED | `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` before source fix | EXPECTED FAIL | Queue clients lacked `useAuth()`, `isLoaded`/`isSignedIn` gating, and explicit `getBearerToken` handoff |
| Clerk readiness race CareBridge guard GREEN | `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` | PASS | 8 tests verify approvals/concerns use readiness-gated Clerk token path and family aliases remain transitive |
| PR #38 non-Clerk crash regression RED | `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` before review-change source fix | EXPECTED FAIL | Tests failed because exported approval/concern clients still called `useAuth()` unconditionally and had no non-Clerk wrapper path |
| PR #38 non-Clerk crash regression GREEN | `node --test apps/web/app/carebridge/carebridge-client-auth.test.js` | PASS | 10 tests verify Clerk-only children call `useAuth()`, exported wrappers do not call `useAuth()` in non-Clerk mode, non-Clerk wrappers preserve cookie/session clientQuery path, and aliases remain transitive |
| PR #38 deploy auth env preflight | sanitized `oasis-staging` alias env check before deploy | BLOCKED / INVALID CHECK | Alias user `deploy` cannot read root-owned `/opt/oasis-care/deploy/v2/.env` or Docker runtime env; failed `NO` result classified as wrong access context, not proof of non-Clerk runtime |
| PR #38 deploy workflow source inspection | `.github/workflows/deploy-vps.yml`, `deploy/v2/docker-compose.yml`, `gh run list --workflow "Deploy VPS"` | COMPLETE | Workflow runs `preflight-env.mjs deploy/v2/.env`, uses compose `--env-file`, does not print env file, and Compose passes auth provider variables to required web/API build/runtime paths |
| PR #38 controlled deploy rerun gate | `.github/workflows/deploy-vps.yml`, `deploy/v2/scripts/preflight-env.mjs`, `deploy/v2/docker-compose.yml` | BLOCKED / NOT TRIGGERED | Source enforces `AUTH_IDENTITY_PROVIDER=clerk` and requires `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER` presence, but does not enforce `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk`; existing workflow does not provide sanitized equality booleans for both provider envs |
| Deployment V2 public Clerk mode preflight RED | `node --test deploy/v2/scripts/preflight-env.test.mjs` before source fix | EXPECTED FAIL | Tests failed because non-Clerk `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER` passed and success output lacked sanitized auth-mode proof |
| Deployment V2 public Clerk mode preflight GREEN | `node --test deploy/v2/scripts/preflight-env.test.mjs` | PASS | 17 tests verify both auth provider envs must be Clerk, sanitized success proof is printed, and failure output does not expose secret values |
| Deployment V2 preflight hardening static gates | CI-equivalent direct static gates: workflow tests, web next config test, Compose tests, verify-local test, preflight tests, smoke tests, synthetic preflight, Compose config, Caddy validation, shell syntax checks | PASS | Sanitized synthetic preflight printed `AUTH_IDENTITY_PROVIDER is clerk: YES`, `NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER is clerk: YES`, and `Auth provider envs match: YES`; no deploy performed |
| Deployment V2 full local verify script | `pnpm deploy:v2:verify`; `corepack pnpm deploy:v2:verify` | BLOCKED | Local dependency build-script approval gating stopped before the script could complete; direct CI-equivalent static gates were run instead |
| Clerk readiness race client GraphQL regression | `./node_modules/.bin/tsx --test apps/web/lib/graphql/client-side.test.ts` | PASS | 4 tests still prove Clerk bearer attachment, caller Authorization priority, no-token fallback, and no token logging |
| Clerk readiness race Clerk extractor regression | `./node_modules/.bin/tsx --test apps/web/lib/auth/clerk.test.ts` | PASS | 14 tests passed |
| Clerk readiness race proxy resolver regression | `./node_modules/.bin/tsx --test apps/web/lib/graphql/proxy-auth.test.ts` | PASS | 6 tests passed |
| Clerk readiness race local diff/lint/build | `git diff --check`; `./node_modules/.bin/next lint`; `./node_modules/.bin/next build`; `corepack pnpm --filter @oasis/web build` | PASS | Local fix builds; not committed or deployed |

No migrations, production-data actions, live payment/email/SMS/fulfilment/order API calls, or production deploys were run.
