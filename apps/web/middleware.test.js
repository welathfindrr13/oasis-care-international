const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const middlewareSource = fs.readFileSync(path.join(__dirname, 'middleware.ts'), 'utf8')

test('Clerk middleware runs for authenticated API proxy routes', () => {
  const matcherBlock = middlewareSource.slice(middlewareSource.indexOf('export const config'))

  assert.doesNotMatch(matcherBlock, /\|api\/graphql/)
  assert.doesNotMatch(matcherBlock, /\|api\/evidence-packs/)
  assert.match(middlewareSource, /'\/api\/graphql\(\.\*\)'/)
  assert.match(middlewareSource, /'\/api\/evidence-packs\(\.\*\)'/)
})
