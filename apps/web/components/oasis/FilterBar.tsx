'use client'

import React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

export interface FilterBarProps {
  className?: string
}

export function FilterBar({ className }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [date, setDate] = React.useState(searchParams.get('date') || '')
  const [carerId, setCarerId] = React.useState(searchParams.get('carerId') || '')
  const [status, setStatus] = React.useState(searchParams.get('status') || '')
  const appliedFilters = [
    searchParams.get('date') ? `Date: ${searchParams.get('date')}` : null,
    searchParams.get('carerId') ? `Carer: ${searchParams.get('carerId')}` : null,
    searchParams.get('status') ? `Status: ${searchParams.get('status')}` : null,
  ].filter(Boolean) as string[]
  const hasPendingChanges =
    date !== (searchParams.get('date') || '') ||
    carerId !== (searchParams.get('carerId') || '') ||
    status !== (searchParams.get('status') || '')

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')

    if (date) params.set('date', date)
    else params.delete('date')

    if (carerId) params.set('carerId', carerId)
    else params.delete('carerId')

    if (status) params.set('status', status)
    else params.delete('status')

    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('date')
    params.delete('carerId')
    params.delete('status')
    params.delete('page')
    setDate('')
    setCarerId('')
    setStatus('')
    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname)
  }

  return (
    <div className={cn('space-y-3 p-4 bg-background-secondary rounded-sm border border-base-gray-300', className)}>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
        <label htmlFor="date-filter" className="text-sm font-medium text-text-secondary">
          Date:
        </label>
        <input
          type="date"
          id="date-filter"
          className={cn(
            'px-3 py-2 border border-base-gray-300 rounded-sm text-sm bg-background-primary',
            'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent',
            'text-text-primary'
          )}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        </div>

        <div className="flex items-center gap-2">
        <label htmlFor="carer-filter" className="text-sm font-medium text-text-secondary">
          Carer:
        </label>
        <input
          type="text"
          id="carer-filter"
          placeholder="Carer ID"
          className={cn(
            'px-3 py-2 border border-base-gray-300 rounded-sm text-sm bg-background-primary',
            'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent',
            'text-text-primary'
          )}
          value={carerId}
          onChange={(e) => setCarerId(e.target.value)}
        />
        </div>

        <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium text-text-secondary">
          Status:
        </label>
        <select 
          id="status-filter"
          className={cn(
            'px-3 py-2 border border-base-gray-300 rounded-sm text-sm bg-background-primary',
            'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent',
            'text-text-primary'
          )}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
          <Button variant="primary" size="sm" onClick={applyFilters}>
            Apply Filters
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-text-secondary" aria-live="polite">
        <div className="flex items-center gap-2 flex-wrap">
          {appliedFilters.length > 0 ? (
            appliedFilters.map((filter) => (
              <span key={filter} className="rounded-full bg-base-white px-3 py-1 border border-base-gray-300">
                {filter}
              </span>
            ))
          ) : (
            <span>No filters applied</span>
          )}
        </div>
        {hasPendingChanges && <span>Changes apply when you click Apply Filters.</span>}
      </div>
    </div>
  )
}
