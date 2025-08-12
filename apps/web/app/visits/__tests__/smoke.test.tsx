import { render, screen } from '@testing-library/react'
import VisitsPage from '../page'

// Mock Next.js usePathname hook
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/visits'),
}))

// Mock GraphQL client
jest.mock('../../lib/graphql/client', () => ({
  query: jest.fn().mockResolvedValue({
    visits: {
      items: [
        {
          id: '1',
          scheduledStart: '2023-10-01T09:00:00Z',
          scheduledEnd: '2023-10-01T10:00:00Z',
          status: 'SCHEDULED',
          client: {
            fullName: 'Test Client',
            addressLine1: '123 Test St',
            addressLine2: null,
          },
          carer: {
            firstName: 'Test',
            lastName: 'Carer',
          },
        }
      ],
      total: 1,
    },
  }),
}))

const defaultProps = {
  searchParams: {}
}

describe('Visits Page', () => {
  it('renders without crashing', async () => {
    const page = await VisitsPage(defaultProps)
    expect(() => render(page)).not.toThrow()
  })

  it('displays the main visits heading', async () => {
    const page = await VisitsPage(defaultProps)
    render(page)
    
    const heading = screen.getByRole('heading', { name: /visits/i })
    expect(heading).toBeInTheDocument()
  })

  it('displays filter controls', async () => {
    const page = await VisitsPage(defaultProps)
    render(page)
    
    // Check for filter labels
    expect(screen.getByText('Date:')).toBeInTheDocument()
    expect(screen.getByText('Carer:')).toBeInTheDocument()
    expect(screen.getByText('Status:')).toBeInTheDocument()
  })

  it('displays visits table headers', async () => {
    const page = await VisitsPage(defaultProps)
    render(page)
    
    // Check for table headers
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Client')).toBeInTheDocument()
    expect(screen.getByText('Carer')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('displays navigation links', async () => {
    const page = await VisitsPage(defaultProps)
    render(page)
    
    // Check for navigation links
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /visits/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /activity/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /emar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /clients/i })).toBeInTheDocument()
  })

  it('displays visits data with status chips', async () => {
    const page = await VisitsPage(defaultProps)
    render(page)
    
    // Check for at least one status chip from mocked data
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
