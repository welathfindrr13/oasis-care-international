import { Metadata } from 'next'
import { Nav } from '../../components/oasis/Nav'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

export const metadata: Metadata = {
  title: 'Clients - Oasis Care',
  description: 'Manage and view client information',
}

// Mock client data - in real app would come from API
const mockClients = [
  { 
    id: 'demo-client-1', 
    name: 'Margaret Thompson', 
    email: 'margaret.thompson@example.com',
    phone: '+44 20 7946 0958',
    address: '15 Oak Street, London SW1A 1AA',
    lastVisit: '2025-08-19T14:30:00Z',
    nextVisit: '2025-08-21T10:00:00Z',
    status: 'active'
  },
  { 
    id: 'demo-client-2', 
    name: 'Robert Smith', 
    email: 'robert.smith@example.com',
    phone: '+44 20 7946 0959',
    address: '42 High Road, London W1K 2HL',
    lastVisit: '2025-08-19T16:00:00Z',
    nextVisit: '2025-08-20T15:30:00Z',
    status: 'active'
  },
  { 
    id: 'demo-client-3', 
    name: 'Emily Davis', 
    email: 'emily.davis@example.com',
    phone: '+44 20 7946 0960',
    address: '28 Church Lane, London EC1A 4JU',
    lastVisit: '2025-08-18T11:00:00Z',
    nextVisit: '2025-08-20T14:00:00Z',
    status: 'active'
  },
  { 
    id: 'demo-client-4', 
    name: 'John Williams', 
    email: 'john.williams@example.com',
    phone: '+44 20 7946 0961',
    address: '7 Victoria Park, London E9 7BT',
    lastVisit: '2025-08-17T13:30:00Z',
    nextVisit: '2025-08-22T09:00:00Z',
    status: 'active'
  },
  { 
    id: 'demo-client-5', 
    name: 'Mary Brown', 
    email: 'mary.brown@example.com',
    phone: '+44 20 7946 0962',
    address: '33 Green Street, London W1K 7PS',
    lastVisit: '2025-08-19T12:00:00Z',
    nextVisit: '2025-08-21T11:30:00Z',
    status: 'active'
  }
]

export default function ClientsPage() {
  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="max-w-7xl mx-auto p-6">
        <Nav />
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary font-heading mb-2">
            Clients
          </h1>
          <p className="text-text-secondary">
            View and manage your care clients
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  Client Directory
                </h2>
                <p className="text-sm text-text-secondary">
                  {mockClients.length} clients registered
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="search"
                  placeholder="Search clients..."
                  className="px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-64"
                />
                <Button variant="primary" size="sm">
                  Add Client
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table 
                className="w-full"
                role="table"
                aria-label="Clients directory"
              >
                <thead>
                  <tr className="border-b border-base-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                      Contact
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                      Address
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                      Last Visit
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                      Next Visit
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockClients.map((client) => (
                    <tr 
                      key={client.id}
                      className="border-b border-base-gray-100 hover:bg-background-accent transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-text-primary">
                            {client.name}
                          </div>
                          <div className="text-sm text-text-secondary">
                            ID: {client.id}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="text-sm text-text-primary">
                            {client.email}
                          </div>
                          <div className="text-sm text-text-secondary">
                            {client.phone}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-text-secondary">
                          {client.address}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <time 
                          className="text-sm text-text-secondary"
                          dateTime={client.lastVisit}
                        >
                          {new Date(client.lastVisit).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </time>
                      </td>
                      <td className="py-3 px-4">
                        <time 
                          className="text-sm text-text-primary font-medium"
                          dateTime={client.nextVisit}
                        >
                          {new Date(client.nextVisit).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </time>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm">
                            Schedule
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Demo Notice */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Demo Data
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>This page shows sample client data for demonstration purposes. In the full application, this would be populated from your client database with real client information and visit history.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
