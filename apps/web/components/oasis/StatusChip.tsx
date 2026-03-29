'use client'

import React from 'react'
import { cn } from '../../lib/utils'

export type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'conflict'

export interface StatusChipProps {
  status: VisitStatus
  className?: string
}

const statusConfig = {
  scheduled: {
    label: 'Scheduled',
    className: 'bg-base-gray-100 text-base-gray-800 border-base-gray-300'
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-brand-blue-light/20 text-brand-blue-primary border-brand-blue-light'
  },
  completed: {
    label: 'Completed',
    className: 'bg-brand-iris-60 text-brand-iris-100 border-brand-iris-80'
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-base-gray-100 text-base-gray-700 border-base-gray-300'
  },
  conflict: {
    label: 'Conflict',
    className: 'bg-brand-fuschia-60 text-brand-fuschia-100 border-brand-fuschia-80'
  }
} as const

export function StatusChip({ status, className }: StatusChipProps) {
  const config = statusConfig[status]
  
  return (
    <span 
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-sm text-xs font-medium border',
        'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:ring-offset-1',
        config.className,
        className
      )}
      role="status"
      aria-label={`Visit status: ${config.label}`}
    >
      <span 
        className={cn('mr-1 h-1.5 w-1.5 rounded-full', {
          'bg-base-gray-500': status === 'scheduled',
          'bg-brand-blue-primary': status === 'in_progress',
          'bg-brand-iris-100': status === 'completed',
          'bg-base-gray-600': status === 'cancelled',
          'bg-brand-fuschia-100': status === 'conflict'
        })}
        aria-hidden="true"
      />
      {config.label}
    </span>
  )
}
