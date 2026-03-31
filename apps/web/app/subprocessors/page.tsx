import Link from 'next/link';

const subprocessors = [
  'Amazon Web Services (hosting, database, storage, and infrastructure services)',
  'Amazon Cognito (authentication and identity management)',
];

export default function SubprocessorsPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Back to sign in
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight">Subprocessors</h1>
          <p className="mt-2 text-slate-500">
            Third-party services currently relied on in the hosted pilot environment.
          </p>
        </div>
        <ul className="space-y-3 text-sm leading-7 text-slate-700">
          {subprocessors.map((entry) => (
            <li key={entry} className="rounded-2xl border border-slate-200 px-4 py-3">
              {entry}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
