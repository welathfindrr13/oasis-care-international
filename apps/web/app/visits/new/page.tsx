import { Metadata } from 'next'
import { Nav } from '../../../components/oasis/Nav'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'

export const metadata: Metadata = {
  title: 'New Visit - Oasis Care',
  description: 'Schedule a new care visit',
}

// Mock data - in real app would come from API
const mockClients = [
  { id: 'demo-client-1', name: 'Margaret Thompson', address: '15 Oak Street, London' },
  { id: 'demo-client-2', name: 'Robert Smith', address: '42 High Road, London' },
  { id: 'demo-client-3', name: 'Emily Davis', address: '28 Church Lane, London' },
  { id: 'demo-client-4', name: 'John Williams', address: '7 Victoria Park, London' },
  { id: 'demo-client-5', name: 'Mary Brown', address: '33 Green Street, London' },
]

const mockCarers = [
  { id: 'demo-carer-1', name: 'Sarah Johnson', availability: 'Available' },
  { id: 'demo-carer-2', name: 'Mike Thompson', availability: 'Available' },
  { id: 'demo-carer-3', name: 'Emma Wilson', availability: 'Busy until 16:00' },
  { id: 'demo-carer-4', name: 'James Roberts', availability: 'Available' },
]

export default function NewVisitPage() {
  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="max-w-7xl mx-auto p-6">
        <Nav />
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary font-heading mb-2">
            Schedule New Visit
          </h1>
          <p className="text-text-secondary">
            Create a new care visit for your clients
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-text-primary font-heading">
                Visit Details
              </h2>
              <p className="text-sm text-text-secondary">
                Fill out the form below to schedule a new visit
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-6">
                {/* Client Selection */}
                <div>
                  <label htmlFor="client" className="block text-sm font-medium text-text-primary mb-2">
                    Client *
                  </label>
                  <select 
                    id="client"
                    name="client"
                    required
                    className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select a client...</option>
                    {mockClients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} - {client.address}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Carer Selection */}
                <div>
                  <label htmlFor="carer" className="block text-sm font-medium text-text-primary mb-2">
                    Carer *
                  </label>
                  <select 
                    id="carer"
                    name="carer"
                    required
                    className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select a carer...</option>
                    {mockCarers.map(carer => (
                      <option key={carer.id} value={carer.id}>
                        {carer.name} ({carer.availability})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startTime" className="block text-sm font-medium text-text-primary mb-2">
                      Start Time *
                    </label>
                    <input
                      type="datetime-local"
                      id="startTime"
                      name="startTime"
                      required
                      defaultValue="2025-08-20T16:00"
                      className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="endTime" className="block text-sm font-medium text-text-primary mb-2">
                      End Time *
                    </label>
                    <input
                      type="datetime-local"
                      id="endTime"
                      name="endTime"
                      required
                      defaultValue="2025-08-20T17:00"
                      className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-text-primary mb-2">
                    Visit Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    placeholder="Add any special instructions or notes for this visit..."
                    className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4 pt-4">
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    Schedule Visit
                  </Button>
                </div>
              </form>

              {/* Demo Notice */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-sm">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Demo Mode
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>This form is currently in demo mode. Submitting will show a success message but won&apos;t create actual visits.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
