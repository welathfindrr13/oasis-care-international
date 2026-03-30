'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, buttonVariants } from '../../../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../../../components/ui/Card'
import { clientQuery } from '../../../../lib/graphql/client-side'
import {
  UPDATE_VISIT_MUTATION,
  type Carer,
  type UpdateVisitMutationResponse,
  type Visit,
} from '../../../../lib/graphql/queries'

interface VisitEditFormProps {
  carers: Carer[]
  visit: Pick<
    Visit,
    'id' | 'scheduledStart' | 'scheduledEnd' | 'status' | 'notes'
  > & {
    client?: { id: string; fullName: string }
    carer?: { id: string; firstName: string; lastName: string }
  }
}

interface VisitEditState {
  carerId: string
  startTime: string
  endTime: string
  notes: string
}

function formatDateTimeLocalValue(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function toLocalDateTimeValue(value: string) {
  return formatDateTimeLocalValue(new Date(value))
}

export default function VisitEditForm({ carers, visit }: VisitEditFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState<VisitEditState>({
    carerId: visit.carer?.id ?? '',
    startTime: toLocalDateTimeValue(visit.scheduledStart),
    endTime: toLocalDateTimeValue(visit.scheduledEnd),
    notes: visit.notes ?? '',
  })

  const validationError = useMemo(() => {
    if (!form.carerId) {
      return 'Select a carer for this visit.'
    }

    if (!form.startTime || !form.endTime) {
      return 'Provide both a start time and an end time.'
    }

    if (new Date(form.endTime) <= new Date(form.startTime)) {
      return 'End time must be after start time.'
    }

    return null
  }, [form])

  const saveChanges = async () => {
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      await clientQuery<UpdateVisitMutationResponse>(UPDATE_VISIT_MUTATION, {
        input: {
          id: visit.id,
          carerId: form.carerId,
          scheduledStart: new Date(form.startTime).toISOString(),
          scheduledEnd: new Date(form.endTime).toISOString(),
          notes: form.notes.trim(),
        },
      })

      router.push(`/visits/${visit.id}`)
      router.refresh()
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to update the visit right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const cancelVisit = async () => {
    const confirmed = window.confirm(
      'Cancel this visit? The visit will remain visible for oversight, but it will no longer appear as active work for carers.'
    )

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      await clientQuery<UpdateVisitMutationResponse>(UPDATE_VISIT_MUTATION, {
        input: {
          id: visit.id,
          status: 'CANCELLED',
        },
      })
      router.push(`/visits/${visit.id}`)
      router.refresh()
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to cancel the visit right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-slate-900 font-heading">Visit management</h2>
        <p className="text-sm text-slate-500">
          Reassign the carer, reschedule the visit window, update coordinator notes, or cancel the visit without deleting the record.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">Client</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {visit.client?.fullName ?? 'Unknown client'}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Task authoring stays on visit creation for this pilot. Existing visit evidence remains read-only here.
          </p>
        </div>

        <div>
          <label htmlFor="carerId" className="mb-2 block text-sm font-medium text-slate-700">
            Assigned carer
          </label>
          <select
            id="carerId"
            name="carerId"
            value={form.carerId}
            onChange={(event) => {
              setForm((current) => ({ ...current, carerId: event.target.value }))
              setError(null)
            }}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Select a carer</option>
            {carers.map((carer) => (
              <option key={carer.id} value={carer.id}>
                {carer.firstName} {carer.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="startTime" className="mb-2 block text-sm font-medium text-slate-700">
              Scheduled start
            </label>
            <input
              id="startTime"
              type="datetime-local"
              value={form.startTime}
              onChange={(event) => {
                setForm((current) => ({ ...current, startTime: event.target.value }))
                setError(null)
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label htmlFor="endTime" className="mb-2 block text-sm font-medium text-slate-700">
              Scheduled end
            </label>
            <input
              id="endTime"
              type="datetime-local"
              value={form.endTime}
              onChange={(event) => {
                setForm((current) => ({ ...current, endTime: event.target.value }))
                setError(null)
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="mb-2 block text-sm font-medium text-slate-700">
            Coordinator notes
          </label>
          <textarea
            id="notes"
            rows={5}
            value={form.notes}
            onChange={(event) => {
              setForm((current) => ({ ...current, notes: event.target.value }))
              setError(null)
            }}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Capture coordination detail that carers and admins should see on visit detail."
          />
        </div>

        {validationError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {validationError}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveChanges}
              disabled={isSubmitting || Boolean(validationError)}
              className={buttonVariants({ variant: 'primary' })}
            >
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
            <Link href={`/visits/${visit.id}`} className={buttonVariants({ variant: 'ghost' })}>
              Back to visit
            </Link>
          </div>

          {visit.status !== 'CANCELLED' && (
            <Button variant="outline" onClick={cancelVisit} disabled={isSubmitting}>
              Cancel visit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
