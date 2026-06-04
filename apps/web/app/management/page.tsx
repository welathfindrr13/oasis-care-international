import Link from 'next/link'
import { Header } from '../../components/oasis/Header'

const managementAreas = [
  { title: 'Workforce', href: '/staff', text: 'Care team directory, shift coverage, training, and supervision readiness.' },
  { title: 'Care Quality', href: '/care-planning', text: 'Assessment-led plans, review dates, exceptions, and improvement work.' },
  { title: 'Reports', href: '/evidence', text: 'Inspection-ready evidence packs, exports, and operational reporting.' },
  { title: 'Family Concerns', href: '/family-updates/concerns', text: 'Concern cases with ownership, SLA clocks, response history, and outcomes.' },
  { title: 'System Health', href: '/admin/metrics', text: 'Operational health, audit surfaces, and platform checks for administrators.' },
  { title: 'Settings', href: '/settings', text: 'Organisation settings, access boundaries, and local development configuration.' },
]

export default function ManagementPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Management</p>
          <h1 className="mt-3 font-heading text-3xl font-black tracking-tight text-slate-950">
            Run care quality, workforce, family concerns, and evidence from one place.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            This is the management layer for the frontier roadmap. The first release links into existing Oasis
            workflows while assessments, care plans, evidence packs, training, and policy governance are built out.
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {managementAreas.map((area) => (
            <Link
              key={area.title}
              href={area.href}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
            >
              <h2 className="font-heading text-xl font-bold text-slate-950">{area.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{area.text}</p>
              <p className="mt-4 text-sm font-semibold text-teal-700">Open workflow</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  )
}
