import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '../../../../components/oasis/Header';
import { requireAdminSession } from '../../../../lib/auth/require-admin';
import { query } from '../../../../lib/graphql/client';
import {
  CLIENT_QUERY,
  CLIENT_SUMMARY_HISTORY_QUERY,
  type ClientQueryResponse,
  type ClientSummaryHistoryQueryResponse,
} from '../../../../lib/graphql/queries';
import SummaryWorkspace from './SummaryWorkspace';

export const metadata: Metadata = {
  title: 'Client AI Summary - Oasis Care',
  description: 'Generate and review AI weekly summaries from live care activity.',
};

export const dynamic = 'force-dynamic';

interface SummaryPageProps {
  params: {
    id: string;
  };
}

async function getClient(id: string) {
  try {
    const response = await query<ClientQueryResponse>(CLIENT_QUERY, { id });
    return response.client;
  } catch (error) {
    console.error('Failed to fetch client for AI summary:', error);
    return null;
  }
}

async function getSummaryHistory(clientId: string) {
  try {
    const response = await query<ClientSummaryHistoryQueryResponse>(CLIENT_SUMMARY_HISTORY_QUERY, {
      clientId,
      take: 12,
    });
    return response.listHistory.items;
  } catch (error) {
    console.error('Failed to fetch AI summary history:', error);
    return [];
  }
}

export default async function SummaryPage({ params }: SummaryPageProps) {
  await requireAdminSession();

  const client = await getClient(params.id);

  if (!client) {
    notFound();
  }

  const history = await getSummaryHistory(client.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <nav className="mb-4 flex" aria-label="Breadcrumb">
            <ol role="list" className="flex items-center space-x-2">
              <li>
                <Link href="/clients" className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  Clients
                </Link>
              </li>
              <li className="text-slate-300">/</li>
              <li>
                <Link href={`/clients/${client.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  {client.fullName}
                </Link>
              </li>
              <li className="text-slate-300">/</li>
              <li className="text-sm font-medium text-slate-900">AI summary</li>
            </ol>
          </nav>
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            {client.preferredName || client.fullName} AI Summary
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Generate a weekly AI draft from recorded visits, tasks, and medication activity, then review it before
            using it as staff-only context.
          </p>
        </div>

        <SummaryWorkspace client={client} initialHistory={history} />
      </main>
    </div>
  );
}
