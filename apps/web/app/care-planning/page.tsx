import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Header } from '../../components/oasis/Header'
import { CarePlanningActions } from '../../components/care-planning/CarePlanningActions'
import { StatePanel } from '../../components/ui/StatePanel'
import { query } from '../../lib/graphql/client'
import {
  formatDate as formatOrganizationDate,
  formatStoredCalendarDate,
} from '../../lib/time'
import {
  CARE_PLANNING_QUERY,
  CLIENTS_QUERY,
  type AssessmentRecord,
  type CarePlanRecord,
  type CarePlanningQueryResponse,
  type ClientListItem,
  type ClientsQueryResponse,
  type EvidencePackRecord,
} from '../../lib/graphql/queries'
import { getServerAuthContext } from '../../lib/auth/server-auth'
import { hasAccessCapability } from '../../lib/auth/capabilities'

export const dynamic = 'force-dynamic'

interface CarePlanningPageProps {
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

async function getCarePlanningSafe(clientId: string): Promise<CarePlanningQueryResponse | null> {
  try {
    return await query<CarePlanningQueryResponse>(CARE_PLANNING_QUERY, { clientId, take: 10 })
  } catch {
    return null
  }
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not set'
  return formatOrganizationDate(value)
}

function countKeys(value?: Record<string, unknown> | null): number {
  return value ? Object.keys(value).length : 0
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'ACTIVE' || status === 'COMPLETED' || status === 'COMPILED'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'ARCHIVED' || status === 'SUPERSEDED'
        ? 'border-slate-200 bg-slate-100 text-slate-600'
        : 'border-amber-200 bg-amber-50 text-amber-700'

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 leading-6">{body}</p>
    </div>
  )
}

function AssessmentList({ assessments }: { assessments: AssessmentRecord[] }) {
  if (!assessments.length) {
    return (
      <EmptyState
        title="No assessments yet"
        body="This is where initial assessments, risk summaries, review findings, and assessment-to-plan evidence will appear."
      />
    )
  }

  return (
    <div className="space-y-3">
      {assessments.map((assessment) => (
        <article key={assessment.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg font-semibold text-slate-950">{assessment.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {assessment.source.replace(/_/g, ' ').toLowerCase()} · created {formatDate(assessment.createdAt)}
              </p>
            </div>
            <StatusPill status={assessment.status} />
          </div>
          {assessment.summary ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">{assessment.summary}</p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-500">No assessment summary recorded yet.</p>
          )}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Findings</dt>
              <dd className="mt-1 font-semibold text-slate-900">{countKeys(assessment.findings)} sections</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Risks</dt>
              <dd className="mt-1 font-semibold text-slate-900">{countKeys(assessment.riskFlags)} flags</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review due</dt>
              <dd className="mt-1 font-semibold text-slate-900">{formatDate(assessment.reviewDueAt)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  )
}

function CarePlanList({ carePlans }: { carePlans: CarePlanRecord[] }) {
  if (!carePlans.length) {
    return (
      <EmptyState
        title="No care-plan versions yet"
        body="Approved, versioned care plans will sit here before they start generating care actions for visits."
      />
    )
  }

  return (
    <div className="space-y-3">
      {carePlans.map((plan) => (
        <article
          key={plan.id}
          className={`rounded-2xl border bg-white p-5 ${
            plan.status === 'ACTIVE' ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg font-semibold text-slate-950">{plan.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                Version {plan.version} · effective {formatDate(plan.effectiveFrom)}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                {plan.status === 'ACTIVE' ? 'Active plan for care delivery' : 'Draft or legacy version'}
              </p>
            </div>
            <StatusPill status={plan.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Goals</dt>
              <dd className="mt-1 font-semibold text-slate-900">{countKeys(plan.goals)} recorded</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Interventions</dt>
              <dd className="mt-1 font-semibold text-slate-900">{countKeys(plan.interventions)} mapped</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review due</dt>
              <dd className="mt-1 font-semibold text-slate-900">{formatDate(plan.reviewDueAt)}</dd>
            </div>
          </dl>
          {plan.safetyNotes && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">{plan.safetyNotes}</p>
          )}
        </article>
      ))}
    </div>
  )
}

function EvidencePackList({ evidencePacks }: { evidencePacks: EvidencePackRecord[] }) {
  if (!evidencePacks.length) {
    return (
      <EmptyState
        title="No evidence packs yet"
        body="Inspection-ready evidence packs collect assessment, plan, visit, and concern evidence without claiming guaranteed compliance."
      />
    )
  }

  return (
    <div className="space-y-3">
      {evidencePacks.map((pack) => (
        <article key={pack.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg font-semibold text-slate-950">
                {pack.kind.replace(/_/g, ' ').toLowerCase()}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {formatStoredCalendarDate(pack.periodStart)} to {formatStoredCalendarDate(pack.periodEnd)} · {pack.items.length} source items
              </p>
            </div>
            <StatusPill status={pack.status} />
          </div>
          {pack.items.length > 0 && (
            <ul className="mt-4 space-y-2">
              {pack.items.slice(0, 3).map((item) => (
                <li key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-semibold text-slate-950">{item.headline}</span>
                  <span className="ml-2 text-xs uppercase tracking-[0.14em] text-slate-500">{item.sourceType}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  )
}

export default async function CarePlanningPage(props: CarePlanningPageProps) {
  const { accessSnapshot } = await getServerAuthContext()
  if (!hasAccessCapability(accessSnapshot.capabilities, 'TENANT_ADMIN')) {
    redirect('/access/unavailable')
  }

  const searchParams = await props.searchParams
  const peopleResult = await getPeopleSafe()
  const people = peopleResult.people
  const selectedPerson = people.find((person) => person.id === searchParams?.clientId) ?? people[0]
  const carePlanning = selectedPerson ? await getCarePlanningSafe(selectedPerson.id) : null
  const carePlanningUnavailable = Boolean(selectedPerson && carePlanning === null)

  const assessments = carePlanning?.assessments ?? []
  const carePlans = carePlanning?.carePlans ?? []
  const evidencePacks = carePlanning?.evidencePacks ?? []
  const activePlan = carePlans.find((plan) => plan.status === 'ACTIVE')

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-amber-50 p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Care planning</p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div>
              <h1 className="font-heading text-3xl font-black tracking-tight text-slate-950">
                Assessment-led care plans are the spine for proof-led care.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                This view connects assessments, approved care-plan versions, and inspection-ready evidence packs for
                each client. It keeps the official care record internal while CareBridge can later project
                approved family-safe updates from the same source trail.
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Person context</p>
              {selectedPerson ? (
                <>
                  <p className="mt-2 font-heading text-xl font-bold text-slate-950">{selectedPerson.fullName}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedPerson.addressLine1}, {selectedPerson.city} {selectedPerson.postcode}
                  </p>
                  <Link
                    href={`/clients/${selectedPerson.id}`}
                    className="mt-4 inline-flex rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    Open client details
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600">Add a client before creating care plans.</p>
              )}
            </div>
          </div>
        </section>

        {peopleResult.unavailable ? (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            title="Care-planning clients are unavailable"
            action={
              <form action="/care-planning" method="get">
                {searchParams?.clientId ? <input type="hidden" name="clientId" value={searchParams.clientId} /> : null}
                <button type="submit" className="rounded-md bg-oasis-teal px-4 py-2 text-sm font-semibold text-white">
                  Try again
                </button>
              </form>
            }
          >
            Client records could not be loaded. No care-planning action is available until the connection recovers.
          </StatePanel>
        ) : (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-slate-950">Choose a client</h2>
              <p className="mt-1 text-sm text-slate-500">
                Care-planning records are scoped to one client and one organisation.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {people.slice(0, 8).map((person) => {
                const active = person.id === selectedPerson?.id
                return (
                  <Link
                    key={person.id}
                    href={`/care-planning?clientId=${person.id}`}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      active
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {person.fullName}
                  </Link>
                )
              })}
            </div>
          </div>
          </section>
        )}

        {selectedPerson && !carePlanningUnavailable && (
          <section className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assessments</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{assessments.length}</p>
              <p className="mt-1 text-sm text-slate-500">Need and risk records</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active plan</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{activePlan ? `v${activePlan.version}` : '-'}</p>
              <p className="mt-1 text-sm text-slate-500">{activePlan ? activePlan.title : 'No active plan yet'}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review due</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{formatDate(activePlan?.reviewDueAt)}</p>
              <p className="mt-1 text-sm text-slate-500">Shown in Today later</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Evidence packs</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{evidencePacks.length}</p>
              <p className="mt-1 text-sm text-slate-500">Inspection-ready, not guaranteed compliance</p>
            </article>
          </section>
        )}

        {carePlanningUnavailable && selectedPerson && (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            title={`Care-planning records for ${selectedPerson.fullName} are unavailable`}
            action={
              <form action="/care-planning" method="get">
                <input type="hidden" name="clientId" value={selectedPerson.id} />
                <button type="submit" className="rounded-md bg-oasis-teal px-4 py-2 text-sm font-semibold text-white">
                  Try again
                </button>
              </form>
            }
          >
            Existing assessments and plans could not be loaded. No changes can be made until the connection recovers.
          </StatePanel>
        )}

        {!peopleResult.unavailable && !carePlanningUnavailable && (
          <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Assess</p>
              <h2 className="font-heading text-xl font-bold text-slate-950">Assessment record</h2>
            </div>
            <AssessmentList assessments={assessments} />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Plan</p>
              <h2 className="font-heading text-xl font-bold text-slate-950">Care-plan versions</h2>
            </div>
            <CarePlanList carePlans={carePlans} />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Prove</p>
              <h2 className="font-heading text-xl font-bold text-slate-950">Evidence packs</h2>
            </div>
            <EvidencePackList evidencePacks={evidencePacks} />
          </div>
          </section>
        )}

        {selectedPerson && !carePlanningUnavailable && (
          <CarePlanningActions
            clientId={selectedPerson.id}
            assessments={assessments}
            carePlans={carePlans}
            onCompleteRedirectPath={`/care-planning?clientId=${selectedPerson.id}`}
          />
        )}
      </main>
    </div>
  )
}
