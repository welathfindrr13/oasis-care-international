'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, buttonVariants } from '../../../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../../../components/ui/Card'
import { clientQuery } from '../../../../lib/graphql/client-side'
import { CREATE_MEDICATION_MUTATION, type CreateMedicationMutationResponse } from '../../../../lib/graphql/queries'

interface MedicationFormState {
  name: string
  dosage: string
  unit: string
  instructions: string
}

const initialState: MedicationFormState = {
  name: '',
  dosage: '',
  unit: '',
  instructions: '',
}

export default function MedicationForm() {
  const router = useRouter()
  const [form, setForm] = useState<MedicationFormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError(null)
    setSuccess(null)
  }

  const canSubmit = Boolean(form.name.trim() && form.dosage.trim() && form.unit.trim()) && !isSubmitting

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSubmit) {
      setError('Complete the medication name, dosage, and unit before saving.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await clientQuery<CreateMedicationMutationResponse>(CREATE_MEDICATION_MUTATION, {
        input: {
          name: form.name.trim(),
          dosage: form.dosage.trim(),
          unit: form.unit.trim(),
          instructions: form.instructions.trim() || null,
        },
      })

      setSuccess(`${response.createMedication.name} added to the medication library.`)
      setForm(initialState)
      router.refresh()
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to create the medication right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold text-slate-900">Add medication</h2>
        <p className="text-sm text-slate-500">
          Create a reusable medication entry that can be assigned to clients later.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">
              Medication name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Paracetamol"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="dosage" className="mb-2 block text-sm font-medium text-slate-700">
                Dosage <span className="text-red-500">*</span>
              </label>
              <input
                id="dosage"
                name="dosage"
                type="text"
                value={form.dosage}
                onChange={handleChange}
                placeholder="e.g. 500"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label htmlFor="unit" className="mb-2 block text-sm font-medium text-slate-700">
                Unit <span className="text-red-500">*</span>
              </label>
              <input
                id="unit"
                name="unit"
                type="text"
                value={form.unit}
                onChange={handleChange}
                placeholder="e.g. mg"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="instructions" className="mb-2 block text-sm font-medium text-slate-700">
              Instructions
            </label>
            <textarea
              id="instructions"
              name="instructions"
              value={form.instructions}
              onChange={handleChange}
              rows={4}
              placeholder="e.g. Take with food"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Saving…' : 'Save Medication'}
            </Button>
            <Link href="/admin/medications" className={buttonVariants({ variant: 'ghost' })}>
              Back to library
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
