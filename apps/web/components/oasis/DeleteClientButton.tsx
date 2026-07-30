'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClientAccess } from '../providers/ClientAccessProvider'
import { Button } from '../ui/Button'
import { clientQuery } from '../../lib/graphql/client-side'
import { DELETE_CLIENT_MUTATION } from '../../lib/graphql/queries'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter()
  const { isAdmin } = useClientAccess()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const submittingRef = useRef(false)
  const archiveButtonId = `archive-client-${clientId}`

  if (!isAdmin) return null

  async function onArchive() {
    if (submittingRef.current) return
    submittingRef.current = true
    setError(null)
    setDeleting(true)
    try {
      await clientQuery(DELETE_CLIENT_MUTATION, { id: clientId })
      setConfirmOpen(false)
      router.push('/clients?archived=1')
    } catch (e: any) {
      setConfirmOpen(false)
      setError(
        e?.message ||
          'The client could not be archived. Check your connection and try again.',
      )
    } finally {
      submittingRef.current = false
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <div role="alert" className="text-sm font-semibold text-oasis-danger">
          {error}
        </div>
      )}
      <Button
        id={archiveButtonId}
        variant="ghost"
        size="sm"
        onClick={() => {
          setError(null)
          setConfirmOpen(true)
        }}
        disabled={deleting}
      >
        Archive client
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={`Archive ${clientName}?`}
        description="The client and their visits will leave active work. Family access for this client ends immediately. Historical records remain. A replacement client needs separate CareBridge setup and permissions."
        confirmLabel={deleting ? 'Archiving…' : 'Archive client'}
        confirmDisabled={deleting}
        returnFocusId={archiveButtonId}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false)
        }}
        onConfirm={() => void onArchive()}
      />
    </div>
  )
}
