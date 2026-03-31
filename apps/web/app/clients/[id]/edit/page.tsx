import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '../../../../components/oasis/Header';
import { requireAdminSession } from '../../../../lib/auth/require-admin';
import { query } from '../../../../lib/graphql/client';
import { CLIENT_QUERY, type ClientQueryResponse } from '../../../../lib/graphql/queries';
import ClientForm from '../../ClientForm';

export const metadata: Metadata = {
  title: 'Edit Client - Oasis Care',
  description: 'Maintain the operational client profile that supports care planning and visit delivery.',
};

export const dynamic = 'force-dynamic';

interface ClientEditPageProps {
  params: {
    id: string;
  };
}

async function getClient(id: string) {
  try {
    const response = await query<ClientQueryResponse>(CLIENT_QUERY, { id });
    return response.client;
  } catch (error) {
    console.error('Failed to fetch client for edit:', error);
    return null;
  }
}

export default async function ClientEditPage({ params }: ClientEditPageProps) {
  await requireAdminSession();

  const client = await getClient(params.id);

  if (!client) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
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
              <li className="text-sm font-medium text-slate-900">Edit profile</li>
            </ol>
          </nav>
          <h1 className="font-heading text-3xl font-bold text-slate-900">
            Edit Client Profile
          </h1>
          <p className="mt-1 text-slate-500">
            Keep the client&apos;s operational profile current before drafting or updating care guidance.
          </p>
        </div>

        <ClientForm mode="edit" client={client} />
      </main>
    </div>
  );
}
