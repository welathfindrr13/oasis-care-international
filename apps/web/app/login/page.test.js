const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

test('Clerk mode renders a dedicated sign-in surface instead of a modal launcher', () => {
  const source = fs.readFileSync(__dirname + '/page.tsx', 'utf8')

  assert.match(source, /<SignIn\b/)
  assert.match(source, /routing="hash"/)
  assert.match(source, /transferable=\{false\}/)
  assert.match(source, /footerAction: 'hidden'/)
  assert.doesNotMatch(source, /signUpUrl=/)
  assert.match(source, /forceRedirectUrl=\{callbackUrl\}/)
  assert.doesNotMatch(source, /fallbackRedirectUrl=/)
  assert.doesNotMatch(source, /<SignInButton/)
  assert.doesNotMatch(source, /<SignUpButton/)
  assert.doesNotMatch(source, /routing="path"/)
})

test('Clerk and the local fixture preserve the normalized callback and fail closed otherwise', () => {
  const source = fs.readFileSync(__dirname + '/page.tsx', 'utf8')

  assert.match(
    source,
    /normalizeCallbackUrl\([\s\S]*searchParams\.get\('callbackUrl'\)[\s\S]*process\.env\.NEXT_PUBLIC_SITE_URL[\s\S]*\)/,
  )
  assert.match(source, /signIn\('oasis-local', \{/)
  assert.match(source, /router\.push\(callbackUrl\)/)
  assert.equal([...source.matchAll(/\bsignIn\('/g)].length, 1)
  assert.match(source, /Sign-in is not configured here\./)
  assert.match(source, /isLocalAuthEnabled\(/)
  assert.match(source, /resolveAuthMode\(/)
})

test('the first heading in source order is the page h1', () => {
  const source = fs.readFileSync(__dirname + '/page.tsx', 'utf8')
  const headings = [...source.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]))

  assert.deepEqual(headings, [1, 2])
})

test('sign-in errors remain bounded and actionable', () => {
  const source = fs.readFileSync(__dirname + '/page.tsx', 'utf8')

  assert.match(source, /We could not complete sign-in\. Try again\./)
  assert.match(source, /We could not sign you in\. Check your details and try again\./)
  assert.match(
    source,
    /Sign-in is not available right now\. Try again or contact your Manager or Oasis support\./,
  )
  assert.doesNotMatch(source, /error\.message|provider configuration|production auth/i)
})
