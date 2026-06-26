const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const carebridgeDir = __dirname;
const webAppDir = path.resolve(carebridgeDir, '..');

function readAppFile(...segments) {
  return fs.readFileSync(path.join(webAppDir, ...segments), 'utf8');
}

test('CareBridge approvals page uses the shared authenticated GraphQL proxy', () => {
  const pageSource = readAppFile('carebridge', 'approvals', 'page.tsx');
  const source = readAppFile('carebridge', 'approvals', 'CareBridgeApprovalsClient.tsx');

  assert.match(pageSource, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(pageSource, /<CareBridgeApprovalsClient \/>/);
  assert.match(source, /from ['"]\.\.\/\.\.\/\.\.\/lib\/graphql\/client-side['"]/);
  assert.match(source, /\bclientQuery</);
  assert.match(source, /\bclientQuery\(/);
  assert.doesNotMatch(source, /useClerkClientQuery/);
});

test('CareBridge concerns page uses the shared authenticated GraphQL proxy', () => {
  const pageSource = readAppFile('carebridge', 'concerns', 'page.tsx');
  const source = readAppFile('carebridge', 'concerns', 'CareBridgeConcernsClient.tsx');

  assert.match(pageSource, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(pageSource, /<CareBridgeConcernsClient \/>/);
  assert.match(source, /from ['"]\.\.\/\.\.\/\.\.\/lib\/graphql\/client-side['"]/);
  assert.match(source, /\bclientQuery</);
  assert.match(source, /\bclientQuery\(/);
  assert.doesNotMatch(source, /useClerkClientQuery/);
});

test('Shared client GraphQL helper sends cookies through the app proxy', () => {
  const source = readAppFile('..', 'lib', 'graphql', 'client-side.ts');

  assert.match(source, /fetch\(['"]\/api\/graphql['"]/);
  assert.match(source, /credentials:\s*['"]include['"]/);
});

test('GraphQL proxy resolves auth centrally from Clerk cookies and server auth', () => {
  const routeSource = readAppFile('api', 'graphql', 'route.ts');

  assert.match(routeSource, /resolveGraphQLProxyAccessToken/);
  assert.match(routeSource, /hasDirectBearer/);
  assert.match(routeSource, /cookieHeader:\s*request\.headers\.get\(['"]cookie['"]\)/);
  assert.match(routeSource, /serverAuthAccessToken:\s*serverAuth\?\.accessToken/);
});

test('Family Updates concerns route remains an alias of the CareBridge concerns page', () => {
  const source = readAppFile('family-updates', 'concerns', 'page.tsx');

  assert.match(source, /import ConcernCasesPage from ['"]\.\.\/\.\.\/carebridge\/concerns\/page['"]/);
  assert.match(source, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(source, /export default ConcernCasesPage/);
  assert.doesNotMatch(source, /\bclientQuery\(/);
});

test('Family Updates approvals route remains an alias of the CareBridge approvals page', () => {
  const source = readAppFile('family-updates', 'approvals', 'page.tsx');

  assert.match(source, /import ReviewQueuePage from ['"]\.\.\/\.\.\/carebridge\/approvals\/page['"]/);
  assert.match(source, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(source, /export default ReviewQueuePage/);
  assert.doesNotMatch(source, /\bclientQuery\(/);
});
