'use client'

import React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, children, ...props }, ref) => {
    const classes = cn(
      // Base button styles using design tokens
      'inline-flex items-center justify-center whitespace-nowrap rounded-full',
      'font-medium transition-all duration-200 ease-in-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-primary focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      
      // Variant styles
      {
        'bg-brand-blue-primary text-base-white hover:bg-brand-blue-medium hover:shadow-md hover:-translate-y-0.5':
          variant === 'primary',
        'bg-base-gray-500 text-base-white hover:bg-base-gray-800 hover:shadow-md hover:-translate-y-0.5':
          variant === 'secondary',
        'border border-brand-blue-primary text-brand-blue-primary bg-transparent hover:bg-brand-blue-primary hover:text-base-white':
          variant === 'outline',
        'text-brand-blue-primary hover:bg-background-accent':
          variant === 'ghost',
      },
      
      // Size styles
      {
        'h-8 px-3 text-xs': size === 'sm',
        'h-10 px-6 text-sm': size === 'md',
        'h-12 px-8 text-base': size === 'lg',
      },
      
      className
    )

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ...props,
        className: cn(classes, (children as React.ReactElement<any>).props?.className),
        ref,
      })
    }

    return (
      <button className={classes} ref={ref} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }
