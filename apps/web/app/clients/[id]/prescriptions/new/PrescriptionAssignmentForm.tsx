'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, buttonVariants } from '../../../../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../../../../components/ui/Card'
import { clientQuery } from '../../../../../lib/graphql/client-side'
import {
  CREATE_PRESCRIPTION_MUTATION,
  type CreatePrescriptionMutationResponse,
  type Medication,
} from '../../../../../lib/graphql/queries'

interface PrescriptionAssignmentFormProps {
  clientId: string
  clientName: string
  medications: Medication[]
}

interface PrescriptionFormState {
  medicationId: string
  startDate: string
  endDate: string
  frequencyPerDay: string
  frequencyIntervalHours: string
  administrationTimes: string
  specialInstructions: string
  isActive: boolean
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function PrescriptionAssignmentForm({
  clientId,
  clientName,
  medications,
}: PrescriptionAssignmentFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<PrescriptionFormState>({
    medicationId: '',
    startDate: formatDateInputValue(new Date()),
    endDate: '',
    frequencyPerDay: '1',
    frequencyIntervalHours: '',
    administrationTimes: '08:00',
    specialInstructions: '',
    isActive: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const parseAdministrationTimes = (value: string) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

  const getValidationError = (nextForm: PrescriptionFormState, administrationTimes: string[]) => {
    if (!nextForm.medicationId) {
      return 'Choose a medication from the library.'
    }

    if (!nextForm.startDate) {
      return 'Choose a prescription start date.'
    }

    const frequencyPerDay = Number(nextForm.frequencyPerDay)
    if (!Number.isInteger(frequencyPerDay) || frequencyPerDay < 1 || frequencyPerDay > 12) {
      return 'Frequency per day must be between 1 and 12.'
    }

    if (!administrationTimes.length) {
      return 'Add at least one administration time in HH:MM format.'
    }

    const invalidTime = administrationTimes.find((value) => !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value))
    if (invalidTime) {
      return `Administration time “${invalidTime}” is not in HH:MM format.`
    }

    if (nextForm.frequencyIntervalHours) {
      const intervalHours = Number(nextForm.frequencyIntervalHours)
      if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 24) {
        return 'Frequency interval must be between 1 and 24 hours.'
      }
    }

    if (nextForm.endDate && new Date(nextForm.endDate) < new Date(nextForm.startDate)) {
      return 'End date must be after the start date.'
    }

    return null
  }

  const parsedAdministrationTimes = useMemo(() => parseAdministrationTimes(form.administrationTimes), [form.administrationTimes])

  const validationError = useMemo(() => getValidationError(form, parsedAdministrationTimes), [form, parsedAdministrationTimes])

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = event.target
    const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value
    const name = target.name as keyof PrescriptionFormState
    setForm((current) => ({ ...current, [name]: value as never }))
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitAttempted(true)

    const formData = new FormData(event.currentTarget)
    const submissionForm: PrescriptionFormState = {
      medicationId: String(formData.get('medicationId') || ''),
      startDate: String(formData.get('startDate') || ''),
      endDate: String(formData.get('endDate') || ''),
      frequencyPerDay: String(formData.get('frequencyPerDay') || ''),
      frequencyIntervalHours: String(formData.get('frequencyIntervalHours') || ''),
      administrationTimes: String(formData.get('administrationTimes') || ''),
      specialInstructions: String(formData.get('specialInstructions') || ''),
      isActive: formData.get('isActive') === 'on',
    }
    const submissionTimes = parseAdministrationTimes(submissionForm.administrationTimes)
    const submissionValidationError = getValidationError(submissionForm, submissionTimes)

    if (submissionValidationError) {
      setError(submissionValidationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await clientQuery<CreatePrescriptionMutationResponse>(CREATE_PRESCRIPTION_MUTATION, {
        input: {
          clientId,
          medicationId: submissionForm.medicationId,
          startDate: new Date(`${submissionForm.startDate}T00:00:00`).toISOString(),
          endDate: submissionForm.endDate ? new Date(`${submissionForm.endDate}T23:59:59`).toISOString() : null,
          frequencyPerDay: Number(submissionForm.frequencyPerDay),
          frequencyIntervalHours: submissionForm.frequencyIntervalHours ? Number(submissionForm.frequencyIntervalHours) : null,
          administrationTimes: submissionTimes,
          specialInstructions: submissionForm.specialInstructions.trim() || null,
          isActive: submissionForm.isActive,
        },
      })

      router.push(`/clients/${clientId}/prescriptions`)
      router.refresh()
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to assign the prescription right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold text-slate-900">Assign medication to {clientName}</h2>
        <p className="text-sm text-slate-500">
          This creates the client’s prescription schedule and seeds medication records for eMAR and matching visits.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="medicationId" className="mb-2 block text-sm font-medium text-slate-700">
              Medication <span className="text-red-500">*</span>
            </label>
            <select
              id="medicationId"
              name="medicationId"
              value={form.medicationId}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Choose a medication...</option>
              {medications.map((medication) => (
                <option key={medication.id} value={medication.id}>
                  {medication.name} · {medication.dosage} {medication.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="startDate" className="mb-2 block text-sm font-medium text-slate-700">
                Start date <span className="text-red-500">*</span>
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="mb-2 block text-sm font-medium text-slate-700">
                End date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="frequencyPerDay" className="mb-2 block text-sm font-medium text-slate-700">
                Times per day <span className="text-red-500">*</span>
              </label>
              <input
                id="frequencyPerDay"
                name="frequencyPerDay"
                type="number"
                min={1}
                max={12}
                value={form.frequencyPerDay}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label htmlFor="frequencyIntervalHours" className="mb-2 block text-sm font-medium text-slate-700">
                Interval hours
              </label>
              <input
                id="frequencyIntervalHours"
                name="frequencyIntervalHours"
                type="number"
                min={1}
                max={24}
                value={form.frequencyIntervalHours}
                onChange={handleChange}
                placeholder="e.g. 12"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="administrationTimes" className="mb-2 block text-sm font-medium text-slate-700">
              Administration times <span className="text-red-500">*</span>
            </label>
            <input
              id="administrationTimes"
              name="administrationTimes"
              type="text"
              value={form.administrationTimes}
              onChange={handleChange}
              placeholder="e.g. 08:00, 20:00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="mt-2 text-xs text-slate-500">Use comma-separated 24-hour times in HH:MM format.</p>
          </div>

          <div>
            <label htmlFor="specialInstructions" className="mb-2 block text-sm font-medium text-slate-700">
              Special instructions
            </label>
            <textarea
              id="specialInstructions"
              name="specialInstructions"
              value={form.specialInstructions}
              onChange={handleChange}
              rows={4}
              placeholder="e.g. Administer after breakfast"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              className="h-4 w-4 rounded border-slate-300 text-brand-blue-primary focus:ring-brand-blue-primary"
            />
            Keep this prescription active
          </label>

          {(error || (submitAttempted && validationError)) && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error || validationError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Assign Prescription'}
            </Button>
            <Link href={`/clients/${clientId}/prescriptions`} className={buttonVariants({ variant: 'ghost' })}>
              Back to prescriptions
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
