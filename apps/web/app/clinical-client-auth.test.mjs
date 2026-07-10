import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const providerSource = readFileSync(
  new URL('../components/providers/AppAuthProviders.tsx', import.meta.url),
  'utf8',
);

const clinicalClients = [
  'visits/new/NewVisitPageClient.tsx',
  'visits/[id]/page.tsx',
  'emar/page.tsx',
  'clients/[id]/care-logs/page.tsx',
];

test('auth mode installs exactly one provider-aware client access source', () => {
  assert.match(providerSource, /ClerkClientAccessProvider/);
  assert.match(providerSource, /NextAuthClientAccessProvider/);
  assert.match(providerSource, /resolveAuthMode\(process\.env\) === 'clerk'/);
});

test('clinical client paths use provider-neutral access instead of NextAuth session roles', () => {
  for (const relativePath of clinicalClients) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');

    assert.match(source, /useClientAccess\(\)/, relativePath);
    assert.doesNotMatch(source, /useSession\(/, relativePath);
    assert.match(source, /\{ getBearerToken \}/, relativePath);
  }
});

test('visit creation and medication keep admin-only controls separate from staff access', () => {
  const visitCreation = readFileSync(
    new URL('visits/new/NewVisitPageClient.tsx', import.meta.url),
    'utf8',
  );
  const medication = readFileSync(new URL('emar/page.tsx', import.meta.url), 'utf8');

  assert.match(visitCreation, /if \(!isAdmin\)/);
  assert.match(medication, /if \(authStatus === 'loading' \|\| !authenticated \|\| !isAdmin\) return/);
  assert.match(medication, /if \(!isStaff\)/);
});
