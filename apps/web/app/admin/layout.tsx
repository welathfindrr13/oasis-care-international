import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { resolveAuthoritativeRoute } from '../../lib/auth/access'
import { getServerAuthContext } from '../../lib/auth/server-auth'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await getServerAuthContext()

  const decision = resolveAuthoritativeRoute('/admin', auth.accessSnapshot)
  if (decision.action === 'redirect') {
    redirect(decision.destination)
  }

  return <>{children}</>
}
