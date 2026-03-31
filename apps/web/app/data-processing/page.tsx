import Link from 'next/link';

export default function DataProcessingPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Back to sign in
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight">Data processing summary</h1>
          <p className="mt-2 text-slate-500">
            A practical overview of how Oasis handles operational care data during the pilot.
          </p>
        </div>
        <div className="space-y-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="font-semibold text-slate-900">Controller and processor model</h2>
            <p>
              Care providers remain the controller for the operational care data they enter into Oasis. Oasis acts as a
              hosted processor for the workflows required to coordinate care delivery.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">Operational categories</h2>
            <p>
              The pilot covers client records, visit scheduling, task evidence, medication scheduling and outcomes,
              care logs, masked audit logs, and supporting health summaries where enabled.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">Data handling stance</h2>
            <p>
              Oasis keeps historical care evidence stable, uses retention-aware erasure handling for sensitive records,
              and exposes subject access processing through an admin-only workflow rather than uncontrolled public
              exports.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
