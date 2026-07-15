/** @type {import('next').NextConfig} */
const path = require('node:path')

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'
const useBrowserClerkStub =
  isDevelopment && process.env.OASIS_BROWSER_CLERK_STUB === 'true'

const unique = (values) => Array.from(new Set(values.filter(Boolean)))

const originFromUrl = (value) => {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const configuredClerkOrigin = (value) => {
  const raw = String(value || '').trim()
  if (!raw) {
    if (isProduction) {
      throw new Error(
        'NEXT_PUBLIC_CLERK_CSP_ORIGINS is required in production and must be one exact HTTPS origin',
      )
    }
    return null
  }

  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error(
      'NEXT_PUBLIC_CLERK_CSP_ORIGINS must be one exact HTTPS origin',
    )
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hostname.includes('*') ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'NEXT_PUBLIC_CLERK_CSP_ORIGINS must be one exact HTTPS origin without credentials, wildcard, path, query, or fragment',
    )
  }

  return url.origin
}

const productionClerkOrigin = configuredClerkOrigin(
  process.env.NEXT_PUBLIC_CLERK_CSP_ORIGINS,
)
const configuredClerkOrigins = unique([
  productionClerkOrigin,
  ...(isDevelopment ? ['https://*.clerk.accounts.dev'] : []),
])

const configuredAppOrigins = unique([
  originFromUrl(process.env.NEXT_PUBLIC_SITE_URL),
  originFromUrl(process.env.NEXTAUTH_URL),
  originFromUrl(process.env.NEXT_PUBLIC_API_URL),
  originFromUrl(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL),
  originFromUrl(process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL),
  originFromUrl(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL),
  originFromUrl(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL),
])

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  ["form-action 'self'", ...configuredAppOrigins].join(' '),
  "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  [
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    ...configuredClerkOrigins,
    'https://challenges.cloudflare.com',
  ].join(' '),
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com",
  ["connect-src 'self'", ...configuredAppOrigins, ...configuredClerkOrigins].join(' '),
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(useBrowserClerkStub ? { devIndicators: false } : {}),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
  webpack(config) {
    if (useBrowserClerkStub) {
      config.resolve.alias['@clerk/nextjs$'] = path.resolve(
        __dirname,
        'lib/auth/clerk-browser-test-stub.tsx',
      )
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
