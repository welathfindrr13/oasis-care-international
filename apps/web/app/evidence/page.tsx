import Link from 'next/link'
import { CarePlanningActions } from '../../components/care-planning/CarePlanningActions'
import { Header } from '../../components/oasis/Header'
import { StatePanel } from '../../components/ui/StatePanel'
import { query } from '../../lib/graphql/client'
import { formatDate, formatStoredCalendarDate } from '../../lib/time'
import {
  CARE_PLANNING_QUERY,
  CLIENT_QUERY,
  CLIENTS_QUERY,
  type CarePlanningQueryResponse,
  type ClientListItem,
  type ClientQueryResponse,
  type ClientsQueryResponse,
} from '../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

interface EvidencePageProps {
  searchParams?: Promise<{
    clientId?: string
  }>
}

async function getPeopleSafe(): Promise<{ people: ClientListItem[]; unavailable: boolean }> {
  try {
    const data = await query<ClientsQueryResponse>(CLIENTS_QUERY, { skip: 0, take: 50 })
    return { people: data.clients.items, unavailable: false }
  } catch {
    return { people: [], unavailable: true }
  }
}

async function getRequestedPersonSafe(clientId: string): Promise<ClientListItem | null> {
  try {
    const data = await query<ClientQueryResponse>(CLIENT_QUERY, { id: clientId })
    return data.client
  } catch {
    return null
  }
}

async function getEvidenceSafe(clientId: string): Promise<CarePlanningQueryResponse | null> {
  try {
    return await query<CarePlanningQueryResponse>(CARE_PLANNING_QUERY, { clientId, take: 20 })
  } catch {
    return null
  }
}

function formatInstantDate(value?: string | null): string {
  if (!value) return 'Not set'
  return formatDate(value)
}

function formatRecordDate(value?: string | null): string {
  if (!value) return 'Not set'
  return formatStoredCalendarDate(value)
}

export default async function EvidencePage(props: EvidencePageProps) {
  const searchParams = await props.searchParams
  const requestedClientId = searchParams?.clientId?.trim()
  const peopleResult = await getPeopleSafe()
  const people = peopleResult.people
  const selectedPerson = requestedClientId
    ? await getRequestedPersonSafe(requestedClientId)
    : people[0]
  const requestedPersonUnavailable = Boolean(requestedClientId && !selectedPerson)
  const carePlanning = selectedPerson ? await getEvidenceSafe(selectedPerson.id) : null
  const evidenceUnavailable = Boolean(selectedPerson && carePlanning === null)
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
            Use this dashboard to track assessment, care-plan, and evidence-pack completeness by client. Evidence
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

        {peopleResult.unavailable ? (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            title="Inspection-record clients are unavailable"
            action={
              <form action="/evidence" method="get">
                {searchParams?.clientId ? <input type="hidden" name="clientId" value={searchParams.clientId} /> : null}
                <button type="submit" className="rounded-md bg-oasis-teal px-4 py-2 text-sm font-semibold text-white">
                  Try again
                </button>
              </form>
            }
          >
            Client records could not be loaded. No inspection record can be created until the connection recovers.
          </StatePanel>
        ) : null}

        {requestedPersonUnavailable ? (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            title="The requested client is unavailable"
            action={
              <form action="/evidence" method="get">
                <input type="hidden" name="clientId" value={requestedClientId} />
                <button type="submit" className="rounded-md bg-oasis-teal px-4 py-2 text-sm font-semibold text-white">
                  Try again
                </button>
              </form>
            }
          >
            No inspection record has been opened. Check the client link or try again.
          </StatePanel>
        ) : null}

        {selectedPerson && !evidenceUnavailable && (
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
              <p className="mt-2 text-xl font-black text-slate-950">{formatInstantDate(latestPack?.generatedAt)}</p>
              <p className="mt-1 text-sm text-slate-500">{latestPack ? latestPack.status : 'No evidence pack yet'}</p>
            </article>
          </section>
        )}

        {evidenceUnavailable && selectedPerson && (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            title={`Inspection records for ${selectedPerson.fullName} are unavailable`}
            action={
              <form action="/evidence" method="get">
                <input type="hidden" name="clientId" value={selectedPerson.id} />
                <button type="submit" className="rounded-md bg-oasis-teal px-4 py-2 text-sm font-semibold text-white">
                  Try again
                </button>
              </form>
            }
          >
            Existing records could not be loaded. No changes can be made until the connection recovers.
          </StatePanel>
        )}

        {!peopleResult.unavailable && !requestedPersonUnavailable && !evidenceUnavailable ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-xl font-bold text-slate-950">Evidence pack timeline</h2>
          <p className="mt-1 text-sm text-slate-600">
            Source-linked evidence packs from approved records. Family and raw operational internals remain restricted.
          </p>
          <div className="mt-4 space-y-3">
            {evidencePacks.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                No evidence packs yet for this client. Create a draft pack to begin an inspection-ready trail.
              </div>
            )}
            {evidencePacks.map((pack) => (
              <article key={pack.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {pack.kind} · {formatRecordDate(pack.periodStart)} to {formatRecordDate(pack.periodEnd)}
                  </p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {pack.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {pack.items.length} evidence items · generated {formatInstantDate(pack.generatedAt)}
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
        ) : null}

        {selectedPerson && !evidenceUnavailable && (
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
