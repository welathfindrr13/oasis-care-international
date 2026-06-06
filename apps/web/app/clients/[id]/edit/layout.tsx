import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getServerAuthContext } from '../../../../lib/auth/server-auth'

export default async function EditClientLayout({ children }: { children: ReactNode }) {
  const { roles } = await getServerAuthContext()

  if (!roles.includes('admin')) {
    redirect('/activity')
  }

  return <>{children}</>
}
