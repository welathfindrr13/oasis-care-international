'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/utils'
import { formatDateInputValueInLondon, formatDate } from '../../lib/time'
import type { Carer } from '../../lib/graphql/queries'

interface VisitsToolbarProps {
  isAdmin: boolean
  carers: Carer[]
  selectedDate: string
  selectedStatus?: string
  selectedCarerId?: string
}

function getCarerLabel(carer: Carer) {
  return `${carer.firstName} ${carer.lastName}`
}

export function VisitsToolbar({
  isAdmin,
  carers,
  selectedDate,
  selectedStatus = '',
  selectedCarerId = '',
}: VisitsToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const todayInLondon = formatDateInputValueInLondon()

  const [date, setDate] = useState(selectedDate)
  const [status, setStatus] = useState(selectedStatus)
  const [carerId, setCarerId] = useState(selectedCarerId)

  const selectedCarer = useMemo(
    () => carers.find((carer) => carer.id === carerId),
    [carerId, carers]
  )

  const activeFilters = useMemo(() => {
    return [
      date ? `Day: ${formatDate(`${date}T12:00:00Z`)}` : null,
      status ? `Status: ${status.replace('_', ' ').toLowerCase()}` : null,
      isAdmin && selectedCarer ? `Carer: ${getCarerLabel(selectedCarer)}` : null,
    ].filter(Boolean) as string[]
  }, [date, isAdmin, selectedCarer, status])

  const hasPendingChanges =
    date !== selectedDate ||
    status !== selectedStatus ||
    (isAdmin && carerId !== selectedCarerId)

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())

    params.set('date', date || todayInLondon)

    if (status) params.set('status', status)
    else params.delete('status')

    if (isAdmin && carerId) params.set('carerId', carerId)
    else params.delete('carerId')

    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const resetQueue = () => {
    setDate(todayInLondon)
    setStatus('')
    setCarerId('')
    router.push(`${pathname}?date=${todayInLondon}`)
  }

  return (
    <div className="mb-6 rounded-3xl border border-base-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="visits-date-filter" className="text-sm font-medium text-text-primary">
                Operational day
              </label>
              <input
                id="visits-date-filter"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={cn(
                  'w-full rounded-2xl border border-base-gray-300 bg-background-primary px-3 py-2 text-sm text-text-primary',
                  'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent'
                )}
              />
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <label htmlFor="visits-carer-filter" className="text-sm font-medium text-text-primary">
                  Carer
                </label>
                <select
                  id="visits-carer-filter"
                  value={carerId}
                  onChange={(event) => setCarerId(event.target.value)}
                  className={cn(
                    'w-full rounded-2xl border border-base-gray-300 bg-background-primary px-3 py-2 text-sm text-text-primary',
                    'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent'
                  )}
                >
                  <option value="">All carers</option>
                  {carers.map((carer) => (
                    <option key={carer.id} value={carer.id}>
                      {getCarerLabel(carer)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="visits-status-filter" className="text-sm font-medium text-text-primary">
                Status
              </label>
              <select
                id="visits-status-filter"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={cn(
                  'w-full rounded-2xl border border-base-gray-300 bg-background-primary px-3 py-2 text-sm text-text-primary',
                  'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent'
                )}
              >
                <option value="">All statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button variant="outline" size="sm" onClick={resetQueue}>
              Reset to today
            </Button>
            <Button variant="primary" size="sm" onClick={applyFilters}>
              Apply filters
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          {activeFilters.map((filter) => (
            <span
              key={filter}
              className="inline-flex items-center rounded-full border border-base-gray-200 bg-slate-50 px-3 py-1 text-text-primary"
            >
              {filter}
            </span>
          ))}
          {hasPendingChanges && (
            <span className="text-brand-blue-primary">
              Filter changes apply when you update the queue.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
