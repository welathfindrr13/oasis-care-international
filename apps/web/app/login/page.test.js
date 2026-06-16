const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

test('custom Clerk login buttons open modals instead of redirecting back to /login', () => {
  const source = fs.readFileSync(__dirname + '/page.tsx', 'utf8')

  assert.match(source, /<SignInButton mode="modal">/)
  assert.match(source, /<SignUpButton mode="modal">/)
  assert.doesNotMatch(source, /<Sign(In|Up)Button mode="redirect">/)
})
