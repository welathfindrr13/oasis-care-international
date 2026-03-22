import Link from 'next/link';
import { Header } from '../../../../components/oasis/Header';
import { buttonVariants } from '../../../../components/ui/Button';

export const dynamic = 'force-dynamic';

interface SummaryPageProps {
  params: {
    id: string;
  };
}

export default function SummaryPage({ params }: SummaryPageProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            AI Summaries Unavailable
          </h1>
          <p className="mt-3 text-slate-600">
            This route is intentionally disabled in staging while the AI summary pipeline is
            being rebuilt on the new Bedrock Haiku runtime.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href={`/clients/${params.id}`} className={buttonVariants({ variant: 'primary' })}>
              Back to Client
            </Link>
            <Link href="/clients" className={buttonVariants({ variant: 'ghost' })}>
              Client Directory
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
