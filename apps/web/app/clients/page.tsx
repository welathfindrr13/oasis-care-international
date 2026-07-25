import { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { getServerAuthContext } from '../../lib/auth/server-auth'
import { query } from '../../lib/graphql/client'
import { formatDateTime } from '../../lib/time'
import {
  CLIENTS_QUERY,
  DEFAULT_PAGE_SIZE,
  getSkipFromPage,
  type ClientsQueryResponse,
  type ClientListItem,
} from '../../lib/graphql/queries'

export const metadata: Metadata = {
  title: 'Clients - Oasis Care',
  description: 'Manage clients and their care context',
}

export const dynamic = 'force-dynamic'

interface ClientsSearchParams {
  search?: string;
  page?: string;
}

interface ClientsPageProps {
  searchParams: Promise<ClientsSearchParams>;
}

async function getClients(searchParams: ClientsSearchParams): Promise<{ clients: ClientListItem[]; total: number }> {
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
    // Important: don't mask auth failures as "empty data" or it looks like the system lost records.
    console.error('Failed to fetch clients:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('401') || message.toLowerCase().includes('unauthorized')) {
      throw new Error('Unauthorized');
    }
    if (message.includes('403') || message.toLowerCase().includes('forbidden')) {
      throw new Error('Forbidden');
    }
    throw new Error('Failed to load clients');
  }
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
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
        {isAdmin ? 'No clients found' : 'No people found'}
      </h3>
      <p className="text-text-secondary mb-4">
        {isAdmin
          ? 'Get started by adding the first client.'
          : 'No people are available right now.'}
      </p>
      {isAdmin && (
        <Button asChild variant="primary">
          <Link href="/clients/new">
            Add client
          </Link>
        </Button>
      )}
    </div>
  )
}

function formatVisitDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  return formatDateTime(dateString, {
    day: 'numeric',
    month: 'short',
  });
}

export default async function ClientsPage(props: ClientsPageProps) {
  const searchParams = await props.searchParams;
  const { roles } = await getServerAuthContext()
  const isAdmin = roles.some((role: unknown) => String(role).toLowerCase() === 'admin')

  let clients: ClientListItem[] = [];
  let total = 0;
  let loadError: string | null = null;

  try {
    const result = await getClients(searchParams);
    clients = result.clients;
    total = result.total;
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Failed to load clients';
  }

  const hasClients = clients.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            {isAdmin ? 'Clients' : 'People'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin
              ? "View each client's care status, visits, Care Notes, and Family access."
              : "View each person's care status and assigned visits."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  {isAdmin ? 'Clients supported' : 'People supported'}
                </h2>
                <p className="text-sm text-text-secondary">
                  {loadError
                    ? `Unable to load ${isAdmin ? 'clients' : 'people'}`
                    : hasClients
                    ? `${clients.length} of ${total} ${isAdmin ? 'clients' : 'people'}`
                    : `No ${isAdmin ? 'clients' : 'people'} found`}
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
                {!isAdmin && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/shift">My Shift</Link>
                  </Button>
                )}
                <form
                  method="get"
                  action={isAdmin ? '/clients' : '/people'}
                  className="flex w-full items-center gap-2 sm:w-auto"
                >
                  <input
                    type="search"
                    name="search"
                    defaultValue={searchParams.search || ''}
                    placeholder={isAdmin ? 'Search clients...' : 'Search people...'}
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 sm:w-64"
                  />
                  <Button type="submit" variant="ghost" size="sm">
                    Search
                  </Button>
                </form>
                {isAdmin && (
                  <Button asChild variant="primary" size="sm">
                    <Link href="/clients/new">
                      Add client
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="font-medium text-red-800 mb-1">Error</div>
                <div className="text-sm text-red-700">
                  {loadError === 'Unauthorized' ? 'You are signed out. Please sign in again.' : loadError}
                </div>
                <div className="mt-4">
                  <Button asChild variant="primary" size="sm">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              </div>
            ) : hasClients ? (
              <>
                <div
                  className="grid gap-4 md:hidden"
                  aria-label={
                    isAdmin
                      ? 'Clients supported directory'
                      : 'People supported directory'
                  }
                >
                  {clients.map((client) => (
                    <article
                      key={client.id}
                      className="rounded-xl border border-base-gray-200 bg-white p-4"
                    >
                      <h3 className="font-semibold text-text-primary">
                        {client.fullName}
                      </h3>
                      <p className="mt-2 text-sm text-text-secondary">
                        {client.addressLine1}
                        {client.addressLine2 ? `, ${client.addressLine2}` : ''}
                        <br />
                        {client.city}, {client.postcode}
                      </p>
                      <dl className="mt-4 grid gap-3 text-sm">
                        <div>
                          <dt className="font-medium text-text-primary">
                            Last visit
                          </dt>
                          <dd className="text-text-secondary">
                            {formatVisitDate(client.lastVisitAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-text-primary">
                            Next visit
                          </dt>
                          <dd className="text-text-secondary">
                            {formatVisitDate(client.nextVisitAt)}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={`/${isAdmin ? 'clients' : 'people'}/${client.id}`}
                          >
                            View
                          </Link>
                        </Button>
                        {isAdmin && (
                          <>
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/clients/${client.id}/edit`}>
                                Edit
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm">
                              <a href={`/visits/new?clientId=${client.id}`}>
                                Schedule
                              </a>
                            </Button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                <table
                  className="w-full"
                  role="table"
                    aria-label={isAdmin ? 'Clients supported directory' : 'People supported directory'}
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
                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b border-base-gray-100 hover:bg-background-accent transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-text-primary">
                            {client.fullName}
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
                          <time
                            className="text-sm text-text-secondary"
                            dateTime={client.lastVisitAt || undefined}
                          >
                            {formatVisitDate(client.lastVisitAt)}
                          </time>
                        </td>
                        <td className="py-3 px-4">
                          <time
                            className={`text-sm ${client.nextVisitAt ? 'text-text-primary font-medium' : 'text-text-secondary'}`}
                            dateTime={client.nextVisitAt || undefined}
                          >
                            {formatVisitDate(client.nextVisitAt)}
                          </time>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/${isAdmin ? 'clients' : 'people'}/${client.id}`}>
                                View
                              </Link>
                            </Button>
                            {isAdmin && (
                              <>
                                <Button asChild variant="ghost" size="sm">
                                  <Link href={`/clients/${client.id}/edit`}>
                                    Edit
                                  </Link>
                                </Button>
                                <Button asChild variant="ghost" size="sm">
                                  <a href={`/visits/new?clientId=${client.id}`}>
                                    Schedule
                                  </a>
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            ) : (
              <EmptyState isAdmin={isAdmin} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
