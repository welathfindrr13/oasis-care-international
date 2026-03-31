import Link from 'next/link';

export default function SecuritySummaryPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Back to sign in
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight">Security summary</h1>
          <p className="mt-2 text-slate-500">
            The current pilot security posture for the hosted Oasis environment.
          </p>
        </div>
        <div className="space-y-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="font-semibold text-slate-900">Authentication and access</h2>
            <p>
              Oasis uses authenticated sessions for app access and role-aware guards for admin, office, and carer
              workflows. Admin-only compliance routes are protected separately from routine care routes.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">Auditability</h2>
            <p>
              Key operational and compliance actions are written to a masked audit log so administrators can review who
              acted, when, and against which resource without re-exposing raw sensitive fields in logs.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">Storage and retention</h2>
            <p>
              Scheduled medication records use database-level integrity controls, and retention policies are visible and
              enforceable through the admin compliance console for selected low-risk categories in the pilot.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
