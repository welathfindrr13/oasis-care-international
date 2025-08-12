'use client'

import React from 'react'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

export interface FilterBarProps {
  className?: string
}

export function FilterBar({ className }: FilterBarProps) {
  return (
    <div className={cn('flex items-center gap-4 p-4 bg-background-secondary rounded-sm border border-base-gray-300', className)}>
      <div className="flex items-center gap-2">
        <label htmlFor="date-filter" className="text-sm font-medium text-text-secondary">
          Date:
        </label>
        <select 
          id="date-filter"
          className={cn(
            'px-3 py-2 border border-base-gray-300 rounded-sm text-sm bg-background-primary',
            'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent',
            'text-text-primary'
          )}
          defaultValue="today"
        >
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="carer-filter" className="text-sm font-medium text-text-secondary">
          Carer:
        </label>
        <select 
          id="carer-filter"
          className={cn(
            'px-3 py-2 border border-base-gray-300 rounded-sm text-sm bg-background-primary',
            'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:border-transparent',
            'text-text-primary'
          )}
          defaultValue="all"
        >
          <option value="all">All Carers</option>
          <option value="sarah">Sarah Johnson</option>
          <option value="mike">Mike Thompson</option>
          <option value="emma">Emma Wilson</option>
        </select>
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
          defaultValue="all"
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="conflict">Conflict</option>
        </select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm">
          Clear Filters
        </Button>
        <Button variant="primary" size="sm">
          Apply Filters
        </Button>
      </div>
    </div>
  )
}
