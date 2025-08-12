# Oasis Components

This directory contains custom UI components specifically designed for the Oasis Care application, built using the existing design tokens and following the established design system.

## Components

### MetricCard
- Displays key metrics with optional trend indicators
- Supports up/down/neutral trend directions with appropriate colors
- Uses design tokens for consistent styling

### StatusChip  
- Shows status information with semantic colors
- Supports: completed, in_progress, scheduled, conflict statuses
- Accessible with proper ARIA roles

### FilterBar
- Provides filtering controls for date, carer, and status
- Responsive design with proper form semantics
- Uses consistent spacing and colors from design tokens

### Nav
- Main navigation component with active state highlighting
- Client-side navigation using Next.js Link
- Accessible with proper ARIA labels and current page indicators

## Usage

All components are built with:
- TypeScript for type safety
- Tailwind CSS with custom design tokens
- Accessibility best practices
- Responsive design principles

Import components directly:
```tsx
import { MetricCard, StatusChip, FilterBar, Nav } from './oasis'
```

## Design Tokens

Components use the existing design token system:
- Colors: `brand-blue-*`, `base-gray-*`, `text-*`, `background-*`
- Typography: `font-heading`, `font-body`
- Spacing: Consistent with Tailwind utilities
- Border radius: `rounded-sm` for consistency
