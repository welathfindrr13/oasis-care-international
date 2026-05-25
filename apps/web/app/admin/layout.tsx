import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/authOptions'
import { hasRole } from '../../lib/auth/roles'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!hasRole((session as any)?.roles ?? [], 'admin')) {
    redirect('/activity')
  }

  return <>{children}</>
}
