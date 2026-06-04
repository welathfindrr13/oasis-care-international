import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../api/auth/[...nextauth]/authOptions'

function normalizeRoles(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((role) => String(role).toLowerCase().trim())
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return [raw.toLowerCase().trim()]
  }
  return []
}

export default async function NewVisitLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  const roles = normalizeRoles((session as any)?.roles ?? [])

  if (!roles.includes('admin')) {
    redirect('/activity')
  }

  return <>{children}</>
}
