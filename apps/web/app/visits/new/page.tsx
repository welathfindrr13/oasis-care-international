import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '../../../components/oasis/Header';
import { CARERS_QUERY, CLIENTS_QUERY, type CarersQueryResponse, type ClientsQueryResponse } from '../../../lib/graphql/queries';
import { query } from '../../../lib/graphql/client';
import { requireAdminSession } from '../../../lib/auth/require-admin';
import VisitCreateForm from './VisitCreateForm';

export const metadata: Metadata = {
  title: 'New Visit - Oasis Care',
  description: 'Schedule a new care visit',
};

export const dynamic = 'force-dynamic';

interface NewVisitPageProps {
  searchParams: {
    clientId?: string;
    client?: string;
    carerId?: string;
    carer?: string;
    startTime?: string;
    endTime?: string;
    notes?: string;
  };
}

async function getVisitFormOptions() {
  const [clientsResult, carersResult] = await Promise.allSettled([
    query<ClientsQueryResponse>(CLIENTS_QUERY, { skip: 0, take: 100 }),
    query<CarersQueryResponse>(CARERS_QUERY, { activeOnly: true }),
  ]);

  const loadErrors: string[] = [];

  const clients = clientsResult.status === 'fulfilled'
    ? clientsResult.value.clients.items
    : [];
  if (clientsResult.status === 'rejected') {
    loadErrors.push('Client options could not be loaded.');
  }

  const carers = carersResult.status === 'fulfilled'
    ? carersResult.value.carers
    : [];
  if (carersResult.status === 'rejected') {
    loadErrors.push('Carer options could not be loaded.');
  }

  return { clients, carers, loadErrors };
}

export default async function NewVisitPage({ searchParams }: NewVisitPageProps) {
  await requireAdminSession();

  const { clients, carers, loadErrors } = await getVisitFormOptions();
  const initialPrefill = {
    clientId: searchParams.clientId ?? searchParams.client,
    carerId: searchParams.carerId ?? searchParams.carer,
    startTime: searchParams.startTime,
    endTime: searchParams.endTime,
    notes: searchParams.notes,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol role="list" className="flex items-center space-x-2">
              <li>
                <Link href="/visits" className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  Visits
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="h-5 w-5 flex-shrink-0 text-slate-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-2 text-sm font-medium text-slate-900">Schedule New Visit</span>
                </div>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold text-slate-900 font-heading">
            Schedule New Visit
          </h1>
          <p className="text-slate-500 mt-1">
            Create a real care visit using live clients and carers.
          </p>
        </div>

        <VisitCreateForm
          clients={clients}
          carers={carers}
          loadErrors={loadErrors}
          initialPrefill={initialPrefill}
        />
      </main>
    </div>
  );
}
