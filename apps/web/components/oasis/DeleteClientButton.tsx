'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '../ui/Button'
import { clientQuery } from '../../lib/graphql/client-side'
import { DELETE_CLIENT_MUTATION } from '../../lib/graphql/queries'

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter()
  const { data: session } = useSession()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roles = Array.isArray((session as any)?.roles) ? (session as any).roles : []
  const isAdmin = roles.some((r: any) => String(r).toLowerCase() === 'admin')

  if (!isAdmin) return null

  async function onDelete() {
    setError(null)
    const ok = confirm(
      `Delete client \"${clientName}\"?\n\nThis is a soft delete for cleanup and will also delete related visits.`
    )
    if (!ok) return

    setDeleting(true)
    try {
      await clientQuery(DELETE_CLIENT_MUTATION, { id: clientId })
      router.push('/clients')
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to delete client')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={deleting}>
        {deleting ? 'Deleting...' : 'Delete'}
      </Button>
    </div>
  )
}

