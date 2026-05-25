import type { Metadata, Viewport } from 'next'
import { SessionProvider } from '../components/providers/SessionProvider'
import { ServiceWorkerRegistration } from '../components/pwa/ServiceWorkerRegistration'
import './globals.css'

export const metadata: Metadata = {
  title: 'Oasis Care',
  description: 'Domiciliary care management platform',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Oasis Care',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f766e',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <ServiceWorkerRegistration />
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
