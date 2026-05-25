'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '../../lib/utils'

const navItems = [
  { href: '/today', label: 'Today' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/people', label: 'People' },
  { href: '/medication', label: 'Medication Round' },
  { href: '/family-updates', label: 'Family Updates' },
] as const

export interface NavProps {
  className?: string
}

export function Nav({ className }: NavProps) {
  const pathname = usePathname()

  return (
    <nav 
      className={cn('mb-6', className)}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-1 p-2 bg-background-secondary rounded-sm border border-base-gray-300">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-3 py-2 rounded-sm text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-brand-blue-primary focus:ring-offset-1',
                'hover:bg-background-primary hover:text-text-primary',
                {
                  'bg-brand-blue-primary text-base-white hover:bg-brand-blue-medium': isActive,
                  'text-text-secondary': !isActive
                }
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
