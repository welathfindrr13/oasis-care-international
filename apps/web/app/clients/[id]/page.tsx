import { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { buttonVariants } from '../../../components/ui/Button'

// Mock client data - same as clients list, would come from API
const mockClients: Record<string, {
  id: string
  name: string
  email: string
  phone: string
  address: string
  dateOfBirth: string
  lastVisit: string
  nextVisit: string
  status: string
  emergencyContact: { name: string; phone: string; relationship: string }
  notes: string
}> = {
  'demo-client-1': {
    id: 'demo-client-1',
    name: 'Margaret Thompson',
    email: 'margaret.thompson@example.com',
    phone: '+44 20 7946 0958',
    address: '15 Oak Street, London SW1A 1AA',
    dateOfBirth: '1945-03-15',
    lastVisit: '2025-08-19T14:30:00Z',
    nextVisit: '2025-08-21T10:00:00Z',
    status: 'active',
    emergencyContact: { name: 'James Thompson', phone: '+44 20 7946 1234', relationship: 'Son' },
    notes: 'Requires assistance with mobility. Prefers morning visits.'
  },
  'demo-client-2': {
    id: 'demo-client-2',
    name: 'Robert Smith',
    email: 'robert.smith@example.com',
    phone: '+44 20 7946 0959',
    address: '42 High Road, London W1K 2HL',
    dateOfBirth: '1938-07-22',
    lastVisit: '2025-08-19T16:00:00Z',
    nextVisit: '2025-08-20T15:30:00Z',
    status: 'active',
    emergencyContact: { name: 'Sarah Smith', phone: '+44 20 7946 5678', relationship: 'Daughter' },
    notes: 'Diabetic - requires medication management.'
  },
  'demo-client-3': {
    id: 'demo-client-3',
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    phone: '+44 20 7946 0960',
    address: '28 Church Lane, London EC1A 4JU',
    dateOfBirth: '1950-11-08',
    lastVisit: '2025-08-18T11:00:00Z',
    nextVisit: '2025-08-20T14:00:00Z',
    status: 'active',
    emergencyContact: { name: 'Michael Davis', phone: '+44 20 7946 9012', relationship: 'Husband' },
    notes: 'Light housekeeping assistance needed.'
  },
  'demo-client-4': {
    id: 'demo-client-4',
    name: 'John Williams',
    email: 'john.williams@example.com',
    phone: '+44 20 7946 0961',
    address: '7 Victoria Park, London E9 7BT',
    dateOfBirth: '1942-02-28',
    lastVisit: '2025-08-17T13:30:00Z',
    nextVisit: '2025-08-22T09:00:00Z',
    status: 'active',
    emergencyContact: { name: 'Anne Williams', phone: '+44 20 7946 3456', relationship: 'Wife' },
    notes: 'Enjoys conversation. Has hearing aid - speak clearly.'
  },
  'demo-client-5': {
    id: 'demo-client-5',
    name: 'Mary Brown',
    email: 'mary.brown@example.com',
    phone: '+44 20 7946 0962',
    address: '33 Green Street, London W1K 7PS',
    dateOfBirth: '1948-09-03',
    lastVisit: '2025-08-19T12:00:00Z',
    nextVisit: '2025-08-21T11:30:00Z',
    status: 'active',
    emergencyContact: { name: 'Peter Brown', phone: '+44 20 7946 7890', relationship: 'Son' },
    notes: 'Vegetarian diet. Enjoys gardening discussions.'
  }
}

// Mock recent visits
const mockRecentVisits = [
  { id: 'v1', date: '2025-08-19T14:30:00Z', carer: 'Sarah Johnson', status: 'completed', duration: '45 min' },
  { id: 'v2', date: '2025-08-17T10:00:00Z', carer: 'Mike Thompson', status: 'completed', duration: '60 min' },
  { id: 'v3', date: '2025-08-15T14:00:00Z', carer: 'Sarah Johnson', status: 'completed', duration: '45 min' },
]

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const client = mockClients[params.id]
  return {
    title: client ? `${client.name} - Oasis Care` : 'Client Not Found - Oasis Care',
    description: client ? `Client profile for ${client.name}` : 'Client not found',
  }
}

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const client = mockClients[params.id]

  if (!client) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Client Not Found</h1>
            <p className="text-slate-600 mb-4">The client you&apos;re looking for doesn&apos;t exist.</p>
            <Link href="/clients" className={buttonVariants({ variant: 'primary' })}>Back to Clients</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/clients" className="text-slate-500 hover:text-slate-700">
                Clients
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li className="text-slate-900 font-medium">{client.name}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              {client.name}
            </h1>
            <p className="text-slate-500 mt-1">Client ID: {client.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/clients/${client.id}/summary`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              🤖 AI Health Summary
            </Link>
            <Link href={`/clients/${client.id}/edit`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Edit
            </Link>
            <Link href={`/visits/new?clientId=${client.id}`} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              Schedule Visit
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Contact Information</h2>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-slate-500">Email</dt>
                    <dd className="text-slate-900">{client.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Phone</dt>
                    <dd className="text-slate-900">{client.phone}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-slate-500">Address</dt>
                    <dd className="text-slate-900">{client.address}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Date of Birth</dt>
                    <dd className="text-slate-900">
                      {new Date(client.dateOfBirth).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Status</dt>
                    <dd>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {client.status}
                      </span>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Recent Visits */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Recent Visits</h2>
                  <Link href={`/visits?clientId=${client.id}`} className="text-sm text-teal-600 hover:text-teal-700">
                    View All →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100">
                  {mockRecentVisits.map((visit) => (
                    <div key={visit.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {new Date(visit.date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <p className="text-sm text-slate-500">Carer: {visit.carer}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{visit.duration}</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          {visit.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Care Notes */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Care Notes</h2>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">{client.notes}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Emergency Contact</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium text-slate-900">{client.emergencyContact.name}</p>
                  <p className="text-sm text-slate-500">{client.emergencyContact.relationship}</p>
                  <p className="text-sm text-slate-600">{client.emergencyContact.phone}</p>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Visits */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Next Visit</h2>
              </CardHeader>
              <CardContent>
                <div className="bg-teal-50 rounded-xl p-4">
                  <p className="text-lg font-semibold text-teal-900">
                    {new Date(client.nextVisit).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </p>
                  <p className="text-teal-700">
                    {new Date(client.nextVisit).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link
                    href={`/emar?clientId=${client.id}`}
                    className="block w-full rounded-xl px-4 py-3 text-left font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    💊 View Medications
                  </Link>
                  <Link
                    href={`/clients/${client.id}/summary`}
                    className="block w-full rounded-xl px-4 py-3 text-left font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    🤖 AI Health Summary
                  </Link>
                  <Link
                    href={`/visits/new?clientId=${client.id}`}
                    className="block w-full rounded-xl bg-teal-50 px-4 py-3 text-left font-medium text-teal-700 transition-colors hover:bg-teal-100"
                  >
                    📅 Schedule Visit
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
