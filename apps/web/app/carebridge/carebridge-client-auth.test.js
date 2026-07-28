const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const carebridgeDir = __dirname;
const webAppDir = path.resolve(carebridgeDir, "..");

function readAppFile(...segments) {
  return fs.readFileSync(path.join(webAppDir, ...segments), "utf8");
}

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} was not found`);
  const end = nextName
    ? source.indexOf(`function ${nextName}(`, start)
    : source.length;
  assert.notEqual(end, -1, `${nextName} was not found`);
  return source.slice(start, end);
}

test("CareBridge approvals page uses the shared authenticated GraphQL proxy", () => {
  const pageSource = readAppFile("carebridge", "approvals", "page.tsx");
  const source = readAppFile(
    "carebridge",
    "approvals",
    "CareBridgeApprovalsClient.tsx",
  );

  assert.match(pageSource, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(
    pageSource,
    /<CareBridgeApprovalsClient[\s\S]*initialCareRoomId=/,
  );
  assert.match(
    source,
    /from ['"]\.\.\/\.\.\/\.\.\/lib\/graphql\/client-side['"]/,
  );
  assert.match(source, /\bclientQuery</);
  assert.match(source, /\bclientQuery\(/);
});

test("CareBridge approvals waits for Clerk readiness before protected queue queries", () => {
  const source = readAppFile(
    "carebridge",
    "approvals",
    "CareBridgeApprovalsClient.tsx",
  );

  assert.match(source, /import \{ useAuth \} from ['"]@clerk\/nextjs['"]/);
  assert.match(
    source,
    /function CareBridgeApprovalsClerkClient\([\s\S]*const \{ isLoaded, isSignedIn, getToken \} = useAuth\(\)/,
  );
  assert.match(source, /authReady=\{isLoaded\}/);
  assert.match(source, /if \(!authReady\) \{\s*return\s*\}/s);
  assert.match(source, /if \(!isSignedIn\) \{/);
  assert.match(
    source,
    /const getBearerToken = useCallback\(\(\) => getToken\(\), \[getToken\]\)/,
  );
  assert.match(source, /getBearerToken=\{getBearerToken\}/);
});

test("CareBridge approvals does not call Clerk useAuth in non-Clerk mode", () => {
  const source = readAppFile(
    "carebridge",
    "approvals",
    "CareBridgeApprovalsClient.tsx",
  );

  assert.match(source, /function isClerkAuthMode\(\)/);
  assert.match(
    source,
    /export function CareBridgeApprovalsClient\([\s\S]*if \(isClerkAuthMode\(\)\) \{[\s\S]*<CareBridgeApprovalsClerkClient/,
  );
  assert.match(
    source,
    /<CareBridgeApprovalsQueueClient[\s\S]*authReady[\s\S]*isSignedIn[\s\S]*initialCareRoomId=/,
  );
  const wrapperSource = functionBlock(
    source,
    "CareBridgeApprovalsClient",
    "CareBridgeApprovalsClerkClient",
  );
  assert.doesNotMatch(wrapperSource, /useAuth\(\)/);
});

test("CareBridge concerns page uses the shared authenticated GraphQL proxy", () => {
  const pageSource = readAppFile("carebridge", "concerns", "page.tsx");
  const source = readAppFile(
    "carebridge",
    "concerns",
    "CareBridgeConcernsClient.tsx",
  );

  assert.match(pageSource, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(pageSource, /<CareBridgeConcernsClient \/>/);
  assert.match(
    source,
    /from ['"]\.\.\/\.\.\/\.\.\/lib\/graphql\/client-side['"]/,
  );
  assert.match(source, /\bclientQuery</);
  assert.match(source, /\bclientQuery\(/);
});

test("CareBridge concerns waits for Clerk readiness before protected inbox queries", () => {
  const source = readAppFile(
    "carebridge",
    "concerns",
    "CareBridgeConcernsClient.tsx",
  );

  assert.match(source, /import \{ useAuth \} from ['"]@clerk\/nextjs['"]/);
  assert.match(
    source,
    /function CareBridgeConcernsClerkClient\(\)[\s\S]*const \{ isLoaded, isSignedIn, getToken \} = useAuth\(\)/,
  );
  assert.match(source, /authReady=\{isLoaded\}/);
  assert.match(source, /if \(!authReady\) \{\s*return\s*\}/s);
  assert.match(source, /if \(!isSignedIn\) \{/);
  assert.match(
    source,
    /const getBearerToken = useCallback\(\(\) => getToken\(\), \[getToken\]\)/,
  );
  assert.match(source, /getBearerToken=\{getBearerToken\}/);
});

test("CareBridge concerns does not call Clerk useAuth in non-Clerk mode", () => {
  const source = readAppFile(
    "carebridge",
    "concerns",
    "CareBridgeConcernsClient.tsx",
  );

  assert.match(source, /function isClerkAuthMode\(\)/);
  assert.match(
    source,
    /export function CareBridgeConcernsClient\(\) \{\s*if \(isClerkAuthMode\(\)\) \{\s*return <CareBridgeConcernsClerkClient \/>/s,
  );
  assert.match(
    source,
    /return <CareBridgeConcernsQueueClient authReady isSignedIn \/>/,
  );
  const wrapperSource = functionBlock(
    source,
    "CareBridgeConcernsClient",
    "CareBridgeConcernsClerkClient",
  );
  assert.doesNotMatch(wrapperSource, /useAuth\(\)/);
});

test("Shared client GraphQL helper sends cookies through the app proxy", () => {
  const source = readAppFile("..", "lib", "graphql", "client-side.ts");

  assert.match(source, /fetch\(['"]\/api\/graphql['"]/);
  assert.match(source, /credentials:\s*['"]include['"]/);
});

test("GraphQL proxy resolves auth centrally from Clerk cookies and server auth", () => {
  const routeSource = readAppFile("api", "graphql", "route.ts");

  assert.match(routeSource, /resolveGraphQLProxyAccessToken/);
  assert.match(routeSource, /hasDirectBearer/);
  assert.match(
    routeSource,
    /cookieHeader:\s*request\.headers\.get\(['"]cookie['"]\)/,
  );
  assert.match(
    routeSource,
    /serverAuthAccessToken:\s*serverAuth\?\.accessToken/,
  );
  assert.match(routeSource, /if \(!accessToken\)/);
  assert.match(
    routeSource,
    /headers\[['"]Authorization['"]\]\s*=\s*`Bearer \$\{accessToken\}`/,
  );
  assert.doesNotMatch(
    routeSource,
    /console\.[a-z]+\([^)]*(accessToken|cookieHeader|directAuthorization|Authorization)/s,
  );
});

test("Family Updates concerns route remains an alias of the CareBridge concerns page", () => {
  const source = readAppFile("family-updates", "concerns", "page.tsx");

  assert.match(
    source,
    /import ConcernCasesPage from ['"]\.\.\/\.\.\/carebridge\/concerns\/page['"]/,
  );
  assert.match(source, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(source, /export default ConcernCasesPage/);
  assert.doesNotMatch(source, /\bclientQuery\(/);
});

test("Family Updates approvals route remains an alias of the CareBridge approvals page", () => {
  const source = readAppFile("family-updates", "approvals", "page.tsx");

  assert.match(
    source,
    /import ReviewQueuePage from ['"]\.\.\/\.\.\/carebridge\/approvals\/page['"]/,
  );
  assert.match(source, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(source, /export default ReviewQueuePage/);
  assert.doesNotMatch(source, /\bclientQuery\(/);
});
