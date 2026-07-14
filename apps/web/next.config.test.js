const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

function loadNextConfig(env = {}) {
  const previousEnv = { ...process.env }
  Object.assign(process.env, env)
  delete require.cache[require.resolve('./next.config')]
  const config = require('./next.config')
  process.env = previousEnv
  return config
}

test('content security policy permits Clerk authentication resources', async () => {
  const nextConfig = loadNextConfig()
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

test('content security policy is driven by Deployment V2 app and Clerk domains', async () => {
  const nextConfig = loadNextConfig({
    NEXTAUTH_URL: 'https://care.example.org',
    NEXT_PUBLIC_SITE_URL: 'https://care.example.org',
    NEXT_PUBLIC_API_URL: 'https://api.care.example.org/graphql',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://care.example.org/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'https://care.example.org/sign-up',
    NEXT_PUBLIC_CLERK_CSP_ORIGINS: 'https://bright-gull-23.clerk.accounts.dev',
  })
  const routes = await nextConfig.headers()
  const appHeaders = routes.find((route) => route.source === '/:path*')?.headers ?? []
  const csp = appHeaders.find((header) => header.key === 'Content-Security-Policy')?.value ?? ''

  assert.match(csp, /form-action[^;]*https:\/\/care\.example\.org/)
  assert.match(csp, /connect-src[^;]*https:\/\/care\.example\.org/)
  assert.match(csp, /connect-src[^;]*https:\/\/api\.care\.example\.org/)
  assert.match(csp, /connect-src[^;]*https:\/\/bright-gull-23\.clerk\.accounts\.dev/)
  assert.doesNotMatch(csp, /amazoncognito\.com/)
  assert.doesNotMatch(csp, /oasis-care\.co/)
})

test('development Clerk browser proof disables only the Next.js dev indicators', () => {
  const browserProof = loadNextConfig({
    NODE_ENV: 'development',
    OASIS_BROWSER_CLERK_STUB: 'true',
  })
  const normalDevelopment = loadNextConfig({
    NODE_ENV: 'development',
    OASIS_BROWSER_CLERK_STUB: 'false',
  })
  const production = loadNextConfig({
    NODE_ENV: 'production',
    OASIS_BROWSER_CLERK_STUB: 'true',
  })

  assert.equal(browserProof.devIndicators, false)
  assert.equal(normalDevelopment.devIndicators, undefined)
  assert.equal(production.devIndicators, undefined)
})

test('service worker registration points at an existing public sw.js asset', () => {
  assert.equal(fs.existsSync(__dirname + '/public/sw.js'), true)
})
