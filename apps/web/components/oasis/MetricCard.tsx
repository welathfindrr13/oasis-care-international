'use client'

import React from 'react'
import { Card, CardContent } from '../ui/Card'
import { cn } from '../../lib/utils'

export interface MetricCardProps {
  title: string
  value: string | number
  trend?: {
    value: string
    direction: 'up' | 'down' | 'neutral'
  }
  className?: string
}

export function MetricCard({ title, value, trend, className }: MetricCardProps) {
  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-6">
        <div className="space-y-2">
          <p className="text-text-secondary text-sm font-medium tracking-wide">
            {title}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-text-primary font-heading">
              {value}
            </p>
            {trend && (
              <div 
                className={cn(
                  'flex items-center px-2 py-1 rounded-sm text-xs font-medium',
                  {
                    'bg-brand-iris-60 text-brand-iris-100': trend.direction === 'up',
                    'bg-brand-fuschia-60 text-brand-fuschia-100': trend.direction === 'down',
                    'bg-base-gray-100 text-base-gray-800': trend.direction === 'neutral'
                  }
                )}
                aria-label={`Trend: ${trend.direction} ${trend.value}`}
              >
                <span 
                  className={cn('mr-1', {
                    '↗': trend.direction === 'up',
                    '↘': trend.direction === 'down',
                    '→': trend.direction === 'neutral'
                  })}
                  aria-hidden="true"
                >
                  {trend.direction === 'up' && '↗'}
                  {trend.direction === 'down' && '↘'}
                  {trend.direction === 'neutral' && '→'}
                </span>
                {trend.value}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
