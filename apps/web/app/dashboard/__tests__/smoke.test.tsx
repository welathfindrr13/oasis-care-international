import { render, screen } from '@testing-library/react'
import DashboardPage from '../page'

// Mock Next.js usePathname hook
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/dashboard'),
}))

describe('Dashboard Page', () => {
  it('renders without crashing', () => {
    expect(() => render(<DashboardPage />)).not.toThrow()
  })

  it('displays the main dashboard heading', () => {
    render(<DashboardPage />)
    
    const heading = screen.getByRole('heading', { name: /oasis dashboard/i })
    expect(heading).toBeInTheDocument()
  })

  it('displays all 4 metric cards', () => {
    render(<DashboardPage />)
    
    // Check for metric card titles
    expect(screen.getByText('Visits Today')).toBeInTheDocument()
    expect(screen.getByText('Carers on Duty')).toBeInTheDocument()
    expect(screen.getByText('Tasks Due')).toBeInTheDocument()
    expect(screen.getByText('Med Alerts')).toBeInTheDocument()
  })

  it('displays the recent activity section', () => {
    render(<DashboardPage />)
    
    const activityHeading = screen.getByRole('heading', { name: /recent activity/i })
    expect(activityHeading).toBeInTheDocument()
  })

  it('displays navigation links', () => {
    render(<DashboardPage />)
    
    // Check for navigation links
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /visits/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /clients/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /carebridge/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /medication/i })).toBeInTheDocument()
  })

  it('displays recent activity items with status chips', () => {
    render(<DashboardPage />)
    
    // Check for status chips in recent activity
    expect(screen.getAllByRole('status')).toHaveLength(5) // 5 activity items
  })

  it('has proper accessibility structure', () => {
    render(<DashboardPage />)
    
    // Check for proper heading hierarchy
    const mainHeading = screen.getByRole('heading', { level: 1 })
    expect(mainHeading).toHaveTextContent('Oasis Dashboard')
    
    const sectionHeading = screen.getByRole('heading', { level: 2 })
    expect(sectionHeading).toHaveTextContent('Recent Activity')
    
    // Check for navigation landmark
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
  })
})
