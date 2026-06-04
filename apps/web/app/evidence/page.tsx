import Link from 'next/link'
import { CarePlanningActions } from '../../components/care-planning/CarePlanningActions'
import { Header } from '../../components/oasis/Header'
import { query } from '../../lib/graphql/client'
import {
  CARE_PLANNING_QUERY,
  CLIENTS_QUERY,
  type CarePlanningQueryResponse,
  type ClientListItem,
  type ClientsQueryResponse,
} from '../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

interface EvidencePageProps {
  searchParams?: {
    clientId?: string
  }
}

async function getPeopleSafe(): Promise<ClientListItem[]> {
  try {
    const data = await query<ClientsQueryResponse>(CLIENTS_QUERY, { skip: 0, take: 50 })
    return data.clients.items
  } catch {
    return []
  }
}

async function getEvidenceSafe(clientId: string): Promise<CarePlanningQueryResponse | null> {
  try {
    return await query<CarePlanningQueryResponse>(CARE_PLANNING_QUERY, { clientId, take: 20 })
  } catch {
    return null
  }
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export default async function EvidencePage({ searchParams }: EvidencePageProps) {
  const people = await getPeopleSafe()
  const selectedPerson = people.find((person) => person.id === searchParams?.clientId) ?? people[0]
  const carePlanning = selectedPerson ? await getEvidenceSafe(selectedPerson.id) : null
  const carePlans = carePlanning?.carePlans ?? []
  const evidencePacks = carePlanning?.evidencePacks ?? []
  const assessments = carePlanning?.assessments ?? []
  const latestPack = evidencePacks[0]

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Prove</p>
          <h1 className="mt-3 font-heading text-3xl font-black tracking-tight text-slate-950">
            Inspection-ready evidence dashboard
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Use this dashboard to track assessment, care-plan, and evidence-pack completeness by person. Evidence
            supports inspection readiness and does not guarantee compliance outcomes.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {people.slice(0, 8).map((person) => (
              <Link
                key={person.id}
                href={`/evidence?clientId=${person.id}`}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  selectedPerson?.id === person.id
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                {person.fullName}
              </Link>
            ))}
          </div>
        </section>

        {selectedPerson && (
          <section className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assessments</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{assessments.length}</p>
              <p className="mt-1 text-sm text-slate-500">Assess records available</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active plan</p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {carePlans.some((plan) => plan.status === 'ACTIVE') ? 'Yes' : 'No'}
              </p>
              <p className="mt-1 text-sm text-slate-500">Plan status for evidence context</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Evidence packs</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{evidencePacks.length}</p>
              <p className="mt-1 text-sm text-slate-500">Pack drafts and published records</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Latest pack</p>
              <p className="mt-2 text-xl font-black text-slate-950">{formatDate(latestPack?.generatedAt)}</p>
              <p className="mt-1 text-sm text-slate-500">{latestPack ? latestPack.status : 'No evidence pack yet'}</p>
            </article>
          </section>
        )}

        {carePlanning === null && selectedPerson && (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            Evidence could not be loaded for this person. You can still create records, then refresh once the API
            connection is healthy.
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-xl font-bold text-slate-950">Evidence pack timeline</h2>
          <p className="mt-1 text-sm text-slate-600">
            Source-linked evidence packs from approved records. Family and raw operational internals remain restricted.
          </p>
          <div className="mt-4 space-y-3">
            {evidencePacks.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                No evidence packs yet for this person. Create a draft pack to begin an inspection-ready trail.
              </div>
            )}
            {evidencePacks.map((pack) => (
              <article key={pack.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {pack.kind} · {formatDate(pack.periodStart)} to {formatDate(pack.periodEnd)}
                  </p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {pack.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {pack.items.length} evidence items · generated {formatDate(pack.generatedAt)}
                </p>
                <div className="mt-3">
                  <Link
                    href={`/api/evidence-packs/${pack.id}/export`}
                    className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                  >
                    Download PDF
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {selectedPerson && (
          <CarePlanningActions
            clientId={selectedPerson.id}
            assessments={assessments}
            carePlans={carePlans}
            onCompleteRedirectPath={`/evidence?clientId=${selectedPerson.id}`}
          />
        )}
      </main>
    </div>
  )
}
