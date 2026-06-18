const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

test('Clerk mode renders a dedicated sign-in surface instead of a modal launcher', () => {
  const source = fs.readFileSync(__dirname + '/page.tsx', 'utf8')

  assert.match(source, /<SignIn\b/)
  assert.doesNotMatch(source, /<SignInButton/)
  assert.doesNotMatch(source, /<SignUpButton/)
})
