'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { clientQuery } from '../../lib/graphql/client-side'
import {
  RAISE_FAMILY_CONCERN_MUTATION,
  type RaiseFamilyConcernMutationResponse,
} from '../../lib/graphql/queries'
import { useClientAccess } from '../providers/ClientAccessProvider'

interface FamilyConcernFormProps {
  careRoomId: string
  personName: string
}

const categories = [
  { value: 'VISIT_DELIVERY', label: 'A visit or care task' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'WELLBEING_CHANGE', label: 'A change in wellbeing' },
  { value: 'SCHEDULING', label: 'Visit timing or schedule' },
  { value: 'OTHER', label: 'Something else' },
] as const

export function FamilyConcernForm({ careRoomId, personName }: FamilyConcernFormProps) {
  const access = useClientAccess()
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [category, setCategory] = useState<(typeof categories)[number]['value']>('COMMUNICATION')
  const [severity, setSeverity] = useState('MEDIUM')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  async function submitConcern(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSubmittedTitle(null)

    try {
      const data = await clientQuery<RaiseFamilyConcernMutationResponse>(
        RAISE_FAMILY_CONCERN_MUTATION,
        {
          input: {
            careRoomId,
            title: title.trim(),
            description: description.trim() || undefined,
            category,
            severity,
          },
        },
        { getBearerToken: access.getBearerToken },
      )
      setSubmittedTitle(data.raiseFamilyCarebridgeConcern.title)
      setTitle('')
      setDescription('')
      setCategory('COMMUNICATION')
      setSeverity('MEDIUM')
      startRefresh(() => router.refresh())
    } catch {
      setError('We could not send your concern. Please try again or contact the care provider directly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {submittedTitle ? (
        <div
          className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-4"
          role="status"
          aria-live="polite"
        >
          <h3 className="font-semibold text-emerald-900">Your concern has been sent</h3>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            “{submittedTitle}” was sent to the care team.
          </p>
          {refreshing ? (
            <p className="mt-1 text-sm text-emerald-800">Updating the status list…</p>
          ) : null}
        </div>
      ) : null}
      <form className="space-y-4" onSubmit={submitConcern}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">
          What is this about?
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
            className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900"
          >
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">
          How important is it?
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900"
          >
            <option value="LOW">Routine question</option>
            <option value="MEDIUM">Important</option>
            <option value="HIGH">Urgent</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-800" htmlFor="family-concern-title">
        Short summary
        <input
          id="family-concern-title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={`What are you worried about for ${personName}?`}
          className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-slate-900"
        />
      </label>

      <label className="block text-sm font-medium text-slate-800">
        Tell us more <span className="font-normal text-slate-500">(optional)</span>
        <textarea
          maxLength={2000}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-slate-900"
        />
      </label>

      {error ? (
        <div ref={errorRef} tabIndex={-1} className="rounded-xl border border-rose-300 bg-rose-50 p-3 outline-none" role="alert">
          <p className="font-semibold text-rose-800">There is a problem</p>
          <a className="mt-1 inline-flex text-sm text-rose-700 underline" href="#family-concern-title">{error}</a>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="inline-flex min-h-11 items-center rounded-full bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send concern to the care team'}
      </button>
      </form>
    </div>
  )
}
