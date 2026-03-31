import Link from 'next/link';

export default function PrivacyNoticePage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Back to sign in
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight">Oasis Care privacy notice</h1>
          <p className="mt-2 text-slate-500">
            This pilot notice explains how Oasis supports domiciliary care operations for provider organisations.
          </p>
        </div>
        <div className="space-y-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="font-semibold text-slate-900">What Oasis is used for</h2>
            <p>
              Oasis is used to coordinate visits, care tasks, medication administration, care notes, and operational
              oversight for domiciliary care teams.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">What data is processed</h2>
            <p>
              The service may contain names, addresses, visit schedules, care notes, medication records, task evidence,
              staff assignment data, and masked audit history needed to operate and review care delivery.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">Why it is processed</h2>
            <p>
              Core care-delivery records are processed under the provider&apos;s lawful basis for health or social care
              operations. Oasis is not using generic marketing-style consent as the default legal basis for routine care.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">Individual rights</h2>
            <p>
              Providers using Oasis can handle access and erasure requests through the admin compliance console. Some
              records may need to be retained or pseudonymized instead of deleted outright when operational or legal
              retention requirements still apply.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
