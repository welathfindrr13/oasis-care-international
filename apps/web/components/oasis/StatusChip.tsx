'use client'

import React from 'react'
import { cn } from '../../lib/utils'

export type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'conflict'

export interface StatusChipProps {
  status: VisitStatus | string
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
    className: 'bg-base-gray-100 text-base-gray-800 border-base-gray-300'
  },
  conflict: {
    label: 'Conflict',
    className: 'bg-brand-fuschia-60 text-brand-fuschia-100 border-brand-fuschia-80'
  }
} as const

function humanizeStatus(status: string): string {
  const normalized = status.trim().replace(/[_-]+/g, ' ').toLowerCase()
  if (!normalized) return 'Unknown'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function StatusChip({ status, className }: StatusChipProps) {
  const normalizedStatus = status.trim().toLowerCase()
  const config = statusConfig[normalizedStatus as VisitStatus] ?? {
    label: humanizeStatus(status),
    className: 'bg-base-gray-100 text-base-gray-800 border-base-gray-300'
  }
  
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
          'bg-base-gray-500':
            normalizedStatus === 'scheduled' ||
            normalizedStatus === 'cancelled' ||
            !(normalizedStatus in statusConfig),
          'bg-brand-blue-primary': normalizedStatus === 'in_progress',
          'bg-brand-iris-100': normalizedStatus === 'completed',
          'bg-brand-fuschia-100': normalizedStatus === 'conflict'
        })}
        aria-hidden="true"
      />
      {config.label}
    </span>
  )
}
