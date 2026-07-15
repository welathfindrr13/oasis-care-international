import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync(new URL('./verify-local.sh', import.meta.url), 'utf8');

test('local Deployment V2 compose verification uses the generated env file', () => {
  assert.match(script, /docker compose --env-file "\$TEMP_ENV" -f deploy\/v2\/docker-compose\.yml config/);
});

test('local Deployment V2 proof assembles non-secret proof and Clerk fixtures at runtime', () => {
  assert.match(
    script,
    /# Assemble local-only values at runtime so the repository never contains/,
  );
  assert.match(script, /^SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID=shift-local-verification$/m);
  assert.match(script, /^SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON=\[\]$/m);
  assert.match(script, /^VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID=visit-local-verification$/m);
  for (const name of [
    'POSTGRES_PASSWORD',
    'DATABASE_URL',
    'JWT_SECRET',
    'NEXTAUTH_SECRET',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET',
    'VISIT_COMPLETION_PROOF_ACTIVE_SECRET',
    'CLERK_SECRET_KEY',
  ]) {
    assert.doesNotMatch(script, new RegExp(`^${name}=\\S+$`, 'm'));
  }
  assert.match(script, /LOCAL_DATABASE_URL="postgresql:\/\/oasis:\$\{LOCAL_POSTGRES_PASSWORD\}@postgres:5432\/oasis"/);
  assert.match(script, /DATABASE_URL="\$LOCAL_DATABASE_URL" \\/);
  assert.match(
    script,
    /printf 'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET=%s\\n' .* \| base64 \| tr -d '\\n'/,
  );
  assert.match(
    script,
    /printf 'VISIT_COMPLETION_PROOF_ACTIVE_SECRET=%s\\n' "\$\(printf '%s' 'local-verification-' 'visit-proof-' 'not-a-credential-value'\)"/,
  );
  assert.match(
    script,
    /printf 'CLERK_SECRET_KEY=%s\\n' "\$\(printf '%s' 'local-verification-' 'not-a-credential-value'\)" >> "\$TEMP_ENV"/,
  );
});
