import { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { buttonVariants } from '../../components/ui/Button'
import { query } from '../../lib/graphql/client'
import {
  CLIENTS_QUERY,
  DEFAULT_PAGE_SIZE,
  getSkipFromPage,
  type ClientsQueryResponse,
  type ClientListItem,
} from '../../lib/graphql/queries'

export const metadata: Metadata = {
  title: 'Clients - Oasis Care',
  description: 'Open live client records and move into prescriptions and visit workflows',
}

export const dynamic = 'force-dynamic'

interface ClientsPageProps {
  searchParams: {
    search?: string;
    page?: string;
  };
}

async function getClients(searchParams: ClientsPageProps['searchParams']): Promise<{ clients: ClientListItem[]; total: number }> {
  try {
    const page = parseInt(searchParams.page || '1', 10);
    const skip = getSkipFromPage(page);

    const variables = {
      take: DEFAULT_PAGE_SIZE,
      skip,
      search: searchParams.search || undefined,
    };

    const response = await query<ClientsQueryResponse>(CLIENTS_QUERY, variables);

    return {
      clients: response.clients.items,
      total: response.clients.total,
    };
  } catch (error) {
    console.error('Failed to fetch clients:', error);
    return { clients: [], total: 0 };
  }
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="mb-4">
        <div className="w-24 h-24 mx-auto bg-base-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-12 h-12 text-base-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">
        No clients found
      </h3>
      <p className="text-text-secondary mb-4">
        No live client records match the current search.
      </p>
    </div>
  )
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { clients, total } = await getClients(searchParams);
  const hasClients = clients.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            Clients
          </h1>
          <p className="text-slate-500 mt-1">
            Open live client records and move into prescriptions, care history, and scheduling.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  Operational client directory
                </h2>
                <p className="text-sm text-text-secondary">
                  {hasClients ? `${clients.length} live records shown from ${total}` : 'No clients found'}
                </p>
              </div>
              <form method="get" action="/clients">
                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    name="search"
                    defaultValue={searchParams.search || ''}
                    placeholder="Search clients..."
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-64"
                  />
                  <button className={buttonVariants({ variant: 'outline', size: 'sm' })} type="submit">
                    Search
                  </button>
                </div>
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {hasClients ? (
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
                        Address
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b border-base-gray-100 hover:bg-background-accent transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-text-primary">
                              {client.fullName}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-text-secondary">
                            <div>{client.addressLine1}</div>
                            {client.addressLine2 && <div>{client.addressLine2}</div>}
                            <div>{client.city}, {client.postcode}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Link href={`/clients/${client.id}`} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                              Open record
                            </Link>
                            <Link href={`/clients/${client.id}/prescriptions`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                              Prescriptions
                            </Link>
                            <Link href={`/visits/new?clientId=${client.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                              Schedule
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
