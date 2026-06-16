# HTTPS / Domain / Cookie Proof Runbook

Issue #11 is the pre-production proof that Oasis can run on a real HTTPS domain with safe browser session behaviour. This runbook is for a fake-data Deployment V2 rehearsal only.

Do not use real client data. Do not use AWS. Do not treat screenshots or logs as evidence if they expose secrets, tokens, cookies, passwords, or private care data.

## 1. Manual Owner Setup

Before any server rehearsal, the owner must:

- choose a UK/EU-preferred domain or staging subdomain;
- add the domain to the chosen DNS provider, such as Cloudflare DNS;
- point DNS `A`/`AAAA` records at the approved fake-data VPS only after infrastructure is approved;
- add the exact app domain to Clerk allowed origins, callback URLs, sign-in URLs, sign-up URLs, and logout/redirect URLs;
- enter real Clerk/server secrets manually into the server env file;
- keep `deploy/v2/.env`, screenshots, logs, and password/token notes out of git.

## 2. Required Environment Shape

The server env must pass:

```bash
pnpm deploy:v2:preflight -- deploy/v2/.env
```

For Issue #11 proof:

- `APP_DOMAIN` is the bare public domain, for example `staging.example.org`;
- `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` are `https://APP_DOMAIN`;
- `NEXT_PUBLIC_API_URL` is HTTPS, usually `https://APP_DOMAIN/graphql`;
- `ALLOWED_ORIGINS` includes the public web origin exactly;
- `AUTH_IDENTITY_PROVIDER=clerk`;
- `LOCAL_AUTH_ENABLED=false` and `NEXT_PUBLIC_LOCAL_AUTH_ENABLED=false`;
- `CLERK_AUTHORIZED_PARTIES` includes the public web origin;
- Clerk sign-in/sign-up/after-auth URLs use the public web origin;
- no public production-like URL points to `localhost`;
- Cognito is not accepted as production auth proof.

## 3. DNS And Caddy HTTPS Proof

After the fake-data VPS is approved and started:

```bash
dig +short APP_DOMAIN
curl -fsS -I http://APP_DOMAIN/login
curl -fsS -I https://APP_DOMAIN/login
```

Acceptance:

- DNS resolves to the approved fake-data VPS;
- HTTP redirects to HTTPS;
- HTTPS returns a valid certificate without `curl -k`;
- the browser shows a valid secure connection;
- Caddy logs do not include secrets, cookies, or tokens.

If Cloudflare proxying is used, TLS mode must be compatible with real certificate validation. Do not use `curl -k` as proof.

## 4. Health And Readiness Proof

Run strict TLS checks:

```bash
curl -fsS https://APP_DOMAIN/health
curl -fsS https://APP_DOMAIN/ready
```

Acceptance:

- both commands succeed without `-k`;
- `/ready` does not expose secrets, tokens, connection strings, or private care data;
- failures are investigated before any authenticated QA.

## 5. Browser Cookie And Session Proof

Use browser devtools on the HTTPS domain after Clerk login/logout:

- confirm Clerk/session cookies are set only on the approved domain;
- confirm production session cookies use `Secure`;
- confirm `HttpOnly` is present where the provider/runtime supports it;
- confirm `SameSite` behaviour works for the selected Clerk session flow;
- confirm logout clears or invalidates the browser session;
- confirm no token appears in page HTML, console output, screenshots, or saved logs.

Safe evidence may include cropped screenshots of cookie names and attributes only. Do not capture cookie values.

## 6. CORS Positive And Negative Proof

Positive origin check from the approved app origin:

```bash
curl -fsS -i \
  -H "Origin: https://APP_DOMAIN" \
  -H "Content-Type: application/json" \
  --data '{"query":"query SmokeTypename { __typename }"}' \
  https://APP_DOMAIN/graphql
```

Negative origin check from an unapproved origin:

```bash
curl -fsS -i \
  -H "Origin: https://evil.invalid" \
  -H "Content-Type: application/json" \
  --data '{"query":"query SmokeTypename { __typename }"}' \
  https://APP_DOMAIN/graphql
```

Acceptance:

- approved origin receives the intended CORS response;
- unapproved origin does not receive `Access-Control-Allow-Origin: https://evil.invalid`;
- no wildcard production origin is accepted.

## 7. Deployment V2 Smoke Proof

Unauthenticated strict TLS smoke:

```bash
BASE_URL=https://APP_DOMAIN deploy/v2/scripts/smoke-test.sh
```

Authenticated smoke with provider session material, entered manually and not logged:

```bash
BASE_URL=https://APP_DOMAIN \
STAFF_COOKIE='<manual-staff-cookie>' \
FAMILY_COOKIE='<manual-family-cookie>' \
deploy/v2/scripts/smoke-test.sh
```

`ALLOW_INSECURE_TLS=1` is only for local/debug certificate troubleshooting. It is not valid Issue #11 evidence.

## 8. CareBridge Boundary Check

Using fake data only, confirm:

- staff can reach staff routes and the GraphQL API;
- family users are redirected away from staff/admin routes;
- family users can access only linked CareBridge room and published family-safe updates;
- family users cannot access raw clients, raw visits, raw care logs, medication internals, evidence packs, or approval queues.

Do not use real client data to prove these flows.

## 9. Evidence Capture Rules

Allowed evidence:

- command names and pass/fail summaries;
- redacted response headers;
- cropped browser screenshots showing domain, TLS status, and cookie attributes without values;
- redacted Caddy/API/web logs with no cookies, tokens, passwords, emails from real people, or care data.

Forbidden evidence:

- `.env` files;
- Clerk secret keys;
- publishable keys copied from a real environment unless already public and intentionally disclosed;
- bearer tokens, cookies, authorization headers, session IDs;
- real client/staff/family data.

## 10. Rollback

For a fake-data VPS rehearsal:

```bash
docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml down
```

If DNS was changed, revert DNS records to the previous value or remove the staging record. If Clerk dashboard URLs were added for the rehearsal, remove or disable unused callback/origin URLs after testing.

Do not run restore or destructive database commands against real client data. Backup/restore production proof is tracked separately.
