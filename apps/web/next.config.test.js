const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

function loadNextConfig(env = {}) {
  const previousValues = new Map(
    Object.keys(env).map((name) => [name, process.env[name]]),
  )

  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }

  try {
    delete require.cache[require.resolve('./next.config')]
    return require('./next.config')
  } finally {
    for (const [name, value] of previousValues) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

test('development content security policy permits Clerk development resources', async () => {
  const nextConfig = loadNextConfig({ NODE_ENV: 'development' })
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

test('production content security policy includes the configured Clerk FAPI origin', async () => {
  const nextConfig = loadNextConfig({
    NODE_ENV: 'production',
    NEXTAUTH_URL: 'https://care.example.org',
    NEXT_PUBLIC_SITE_URL: 'https://care.example.org',
    NEXT_PUBLIC_API_URL: 'https://api.care.example.org/graphql',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://care.example.org/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'https://care.example.org/sign-up',
    NEXT_PUBLIC_CLERK_CSP_ORIGINS: 'https://bright-gull-23.clerk.accounts.dev/',
  })
  const routes = await nextConfig.headers()
  const appHeaders = routes.find((route) => route.source === '/:path*')?.headers ?? []
  const csp = appHeaders.find((header) => header.key === 'Content-Security-Policy')?.value ?? ''

  assert.match(csp, /form-action[^;]*https:\/\/care\.example\.org/)
  assert.match(csp, /connect-src[^;]*https:\/\/care\.example\.org/)
  assert.match(csp, /connect-src[^;]*https:\/\/api\.care\.example\.org/)
  assert.match(csp, /script-src[^;]*https:\/\/bright-gull-23\.clerk\.accounts\.dev/)
  assert.match(csp, /connect-src[^;]*https:\/\/bright-gull-23\.clerk\.accounts\.dev/)
  assert.doesNotMatch(csp, /https:\/\/bright-gull-23\.clerk\.accounts\.dev\//)
  assert.doesNotMatch(csp, /https:\/\/\*\.clerk\.accounts\.dev/)
  assert.doesNotMatch(csp, /amazoncognito\.com/)
  assert.doesNotMatch(csp, /oasis-care\.co/)
})

test('production CSP fails closed without one exact Clerk FAPI origin', () => {
  assert.throws(
    () =>
      loadNextConfig({
        NODE_ENV: 'production',
        NEXT_PUBLIC_CLERK_CSP_ORIGINS: undefined,
      }),
    /NEXT_PUBLIC_CLERK_CSP_ORIGINS is required in production/,
  )

  for (const value of [
    'http://clerk.example.org',
    'https://user@clerk.example.org',
    'https://*.clerk.accounts.dev',
    'https://clerk.example.org/path',
    'https://clerk.example.org?region=eu',
    'https://clerk.example.org#fragment',
    'https://first.example.org,https://second.example.org',
  ]) {
    assert.throws(
      () =>
        loadNextConfig({
          NODE_ENV: 'production',
          NEXT_PUBLIC_CLERK_CSP_ORIGINS: value,
        }),
      /NEXT_PUBLIC_CLERK_CSP_ORIGINS must be one exact HTTPS origin/,
    )
  }
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
    NEXT_PUBLIC_CLERK_CSP_ORIGINS: 'https://clerk.example.org',
  })

  assert.equal(browserProof.devIndicators, false)
  assert.equal(normalDevelopment.devIndicators, undefined)
  assert.equal(production.devIndicators, undefined)
})

test('service worker registration points at an existing public sw.js asset', () => {
  assert.equal(fs.existsSync(__dirname + '/public/sw.js'), true)
})
