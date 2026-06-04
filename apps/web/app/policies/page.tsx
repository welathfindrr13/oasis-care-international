import { Header } from '../../components/oasis/Header'

export default function PoliciesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Policies and procedures</p>
          <h1 className="mt-3 font-heading text-3xl font-black tracking-tight text-slate-950">
            A governed policy library is planned, separate from Family Updates visibility policy.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            This area will hold policy versions, review dates, staff acknowledgements, and evidence exports. It will
            not replace CareBridgePolicy, which remains only for family-visible content rules.
          </p>
        </section>
      </main>
    </div>
  )
}
