const assert = require('node:assert/strict')
const test = require('node:test')

const nextConfig = require('./next.config')

test('content security policy permits Clerk authentication resources', async () => {
  const routes = await nextConfig.headers()
  const appHeaders = routes.find((route) => route.source === '/:path*')?.headers ?? []
  const csp = appHeaders.find((header) => header.key === 'Content-Security-Policy')?.value ?? ''

  assert.match(csp, /script-src[^;]*https:\/\/\*\.clerk\.accounts\.dev/)
  assert.match(csp, /script-src[^;]*https:\/\/challenges\.cloudflare\.com/)
  assert.match(csp, /connect-src[^;]*https:\/\/\*\.clerk\.accounts\.dev/)
  assert.match(csp, /img-src[^;]*https:\/\/img\.clerk\.com/)
  assert.match(csp, /worker-src[^;]*blob:/)
  assert.match(csp, /frame-src[^;]*https:\/\/challenges\.cloudflare\.com/)
})
