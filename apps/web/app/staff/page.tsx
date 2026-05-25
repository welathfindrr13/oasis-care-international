import Link from 'next/link'
import { Header } from '../../components/oasis/Header'

export default function StaffPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Workforce</p>
          <h1 className="mt-3 font-heading text-3xl font-black tracking-tight text-slate-950">
            Care team management, training, supervision, and shift visibility.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            The next workforce layer will add training matrices, supervision notes, appraisal records, competency
            sign-off, and compliance alerts. For now, this hub links into the active staff and analytics tools.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin/carers" className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
              Open carer directory
            </Link>
            <Link href="/admin/analytics" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              View workforce analytics
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
