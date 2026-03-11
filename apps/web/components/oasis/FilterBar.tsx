'use client'

import React, { useMemo, useState } from 'react'
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
  const [date, setDate] = useState(searchParams.get('date') || '')
  const [carerId, setCarerId] = useState(searchParams.get('carerId') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')

  const activeFilters = useMemo(() => {
    return [
      date ? `Date: ${date}` : null,
      carerId ? `Carer: ${carerId}` : null,
      status ? `Status: ${status}` : null,
    ].filter(Boolean) as string[]
  }, [date, carerId, status])

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())

    if (date) params.set('date', date)
    else params.delete('date')

    if (carerId) params.set('carerId', carerId)
    else params.delete('carerId')

    if (status) params.set('status', status)
    else params.delete('status')

    params.delete('page')
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname)
  }

  const clearFilters = () => {
    setDate('')
    setCarerId('')
    setStatus('')
    router.push(pathname)
  }

  const hasPendingChanges =
    date !== (searchParams.get('date') || '') ||
    carerId !== (searchParams.get('carerId') || '') ||
    status !== (searchParams.get('status') || '')

  return (
    <div className={cn('space-y-3 p-4 bg-background-secondary rounded-sm border border-base-gray-300', className)}>
      <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="date-filter" className="text-sm font-medium text-text-secondary">
          Date:
        </label>
        <input
          id="date-filter"
          type="date"
          className={cn(
            'px-3 py-2 border border-base-gray-300 rounded-sm text-sm bg-background-primary',
            'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent',
            'text-text-primary'
          )}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="carer-filter" className="text-sm font-medium text-text-secondary">
          Carer:
        </label>
        <input
          id="carer-filter"
          type="text"
          placeholder="Enter carer ID"
          className={cn(
            'px-3 py-2 border border-base-gray-300 rounded-sm text-sm bg-background-primary',
            'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent',
            'text-text-primary'
          )}
          value={carerId}
          onChange={(event) => setCarerId(event.target.value)}
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
          onChange={(event) => setStatus(event.target.value)}
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

      <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        {activeFilters.length > 0 ? (
          activeFilters.map((filter) => (
            <span
              key={filter}
              className="inline-flex items-center rounded-full bg-white px-3 py-1 border border-base-gray-300 text-text-primary"
            >
              {filter}
            </span>
          ))
        ) : (
          <span>No filters applied.</span>
        )}
        {hasPendingChanges && (
          <span className="text-brand-blue-primary">Changes apply when you click Apply Filters.</span>
        )}
      </div>
    </div>
  )
}
