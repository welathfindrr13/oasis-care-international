import Link from 'next/link'
import { Metadata } from 'next'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { buttonVariants } from '../../../components/ui/Button'
import { requireAdminSession } from '../../../lib/auth/require-admin'

export const metadata: Metadata = {
  title: 'Pilot Story - Oasis Care',
  description: 'Admin-only proof points for the Oasis pilot release',
}

const pillars = [
  {
    title: 'Client record',
    summary:
      'Each client record now acts as the operational source of truth: profile, representative details, active prescriptions, visit snapshot, and the current care-plan status all sit together.',
    links: [
      { href: '/clients', label: 'Open client directory' },
      { href: '/clients/34bd571f-22cd-4bcc-a296-f576ba3dbbc3', label: 'Open live client record' },
    ],
  },
  {
    title: 'Care plans',
    summary:
      'Staff can draft, publish, supersede, and review immutable care-plan versions. Carers read the active guidance inside the visit workspace, while coordinators can inspect version history and the care-plan audit trail.',
    links: [
      { href: '/clients/34bd571f-22cd-4bcc-a296-f576ba3dbbc3/care-plan', label: 'Open live care-plan record' },
      { href: '/clients/34bd571f-22cd-4bcc-a296-f576ba3dbbc3', label: 'Open client care-plan summary' },
    ],
  },
  {
    title: 'Visits',
    summary:
      'The daily visit queue is the operating spine: coordinators can triage, reschedule, reassign, cancel, and reconcile while carers move from queue into the visit workspace without losing context.',
    links: [
      { href: '/visits', label: 'Open visit queue' },
      { href: '/visits/501a4c46-9e48-4841-be43-c3fd72afb071', label: 'Open live visit record' },
    ],
  },
  {
    title: 'eMAR',
    summary:
      'Medication execution is grounded in real scheduled administrations. Carers can work from the visit workspace or directly from eMAR to record administered, missed, or refused outcomes.',
    links: [
      { href: '/emar', label: 'Open eMAR' },
      { href: '/clients', label: 'Open client records' },
    ],
  },
  {
    title: 'Compliance console',
    summary:
      'The pilot includes an admin-only compliance route for subject access, retention-aware erasure, retention enforcement, masked audit review, and in-app legal references. It is intentionally operational rather than enterprise-heavy.',
    links: [
      { href: '/admin/compliance', label: 'Open compliance console' },
      { href: '/privacy', label: 'Privacy notice' },
      { href: '/data-processing', label: 'Data processing summary' },
      { href: '/security', label: 'Security summary' },
      { href: '/subprocessors', label: 'Subprocessors' },
    ],
  },
] as const

export default async function AdminPilotPage() {
  await requireAdminSession()

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 max-w-4xl">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Pilot release story</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">What this Oasis pilot is ready to prove</h1>
          <p className="mt-2 text-slate-500">
            This admin-only page packages the strongest live routes in the product. It is deliberately grounded in the
            workflows Oasis already supports instead of promising a broader platform than the pilot actually ships.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Pilot framing</h2>
          <p className="mt-2 text-sm text-slate-600">
            Oasis is strongest today when read as one connected flow: keep the client record current, publish the care
            plan, carry that guidance into the visit, execute medication safely, and back the pilot with a real privacy
            and compliance posture.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <h2 className="font-heading text-lg font-semibold text-teal-950">Recommended demo path</h2>
          <p className="mt-2 text-sm text-teal-900">
            Walk buyers through the live spine in this order so the product story stays grounded in one coherent care-delivery flow.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/clients/34bd571f-22cd-4bcc-a296-f576ba3dbbc3" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              1. Client record
            </Link>
            <Link href="/clients/34bd571f-22cd-4bcc-a296-f576ba3dbbc3/care-plan" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              2. Care plan
            </Link>
            <Link href="/visits/501a4c46-9e48-4841-be43-c3fd72afb071" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              3. Visit
            </Link>
            <Link href="/emar" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              4. eMAR
            </Link>
            <Link href="/admin/compliance" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              5. Compliance
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {pillars.map((pillar) => (
            <Card key={pillar.title} className="rounded-2xl border-slate-100">
              <CardHeader>
                <h2 className="font-heading text-xl font-semibold text-slate-900">{pillar.title}</h2>
              </CardHeader>
              <CardContent className="mb-0 space-y-4">
                <p className="text-sm text-slate-600">{pillar.summary}</p>
                <div className="flex flex-wrap gap-3">
                  {pillar.links.map((link) => (
                    <Link
                      key={`${pillar.title}-${link.href}`}
                      href={link.href}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-heading text-lg font-semibold text-amber-950">Intentionally out of scope for this freeze</h2>
          <p className="mt-2 text-sm text-amber-900">
            This pilot does not claim a rostering engine, billing, incidents and complaints tooling, a rich activity
            feed, or a full enterprise compliance platform. The release is being frozen around the routes above because
            those are the flows already proven in staging.
          </p>
        </div>
      </main>
    </div>
  )
}
