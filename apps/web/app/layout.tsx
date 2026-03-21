import type { Metadata } from 'next'
import { Session, getServerSession } from 'next-auth'
import { SessionProvider } from '../components/providers/SessionProvider'
import { authOptions } from '../lib/auth/auth-options'
import './globals.css'

export const metadata: Metadata = {
  title: 'Oasis Care',
  description: 'Domiciliary care management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sessionPromise = getServerSession(authOptions)

  return (
    <RootLayoutContent sessionPromise={sessionPromise}>{children}</RootLayoutContent>
  )
}

async function RootLayoutContent({
  children,
  sessionPromise,
}: {
  children: React.ReactNode
  sessionPromise: ReturnType<typeof getServerSession>
}) {
  const session = (await sessionPromise) as Session | null

  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
