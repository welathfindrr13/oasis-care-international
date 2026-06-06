import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { hasRole } from '../../lib/auth/roles'
import { getServerAuthContext } from '../../lib/auth/server-auth'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await getServerAuthContext()

  if (!hasRole(auth.roles, 'admin')) {
    redirect('/activity')
  }

  return <>{children}</>
}
