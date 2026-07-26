import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Header } from '../../components/oasis/Header'
import { CarePlanningActions } from '../../components/care-planning/CarePlanningActions'
import { StatePanel } from '../../components/ui/StatePanel'
import { StatusLabel, type StatusTone } from '../../components/ui/StatusLabel'
import { query } from '../../lib/graphql/client'
import { formatDate as formatOrganizationDate } from '../../lib/time'
import {
  CARE_PLANNING_QUERY,
  CLIENT_CONTEXT_QUERY,
  CLIENT_CONTEXTS_QUERY,
  type AssessmentRecord,
  type CarePlanRecord,
  type CarePlanningQueryResponse,
  type ClientContext,
  type ClientContextQueryResponse,
  type ClientContextsQueryResponse,
} from '../../lib/graphql/queries'
import { getServerAuthContext } from '../../lib/auth/server-auth'
import { hasAccessCapability } from '../../lib/auth/capabilities'

export const dynamic = 'force-dynamic'

interface CarePlanningPageProps {
  searchParams?: Promise<{
    clientId?: string | string[]
  }>
}

async function getClientsSafe(): Promise<{
  clients: ClientContext[]
  unavailable: boolean
}> {
  try {
    const data = await query<ClientContextsQueryResponse>(
      CLIENT_CONTEXTS_QUERY,
      {
        skip: 0,
        take: 50,
      },
    )
    return { clients: data.clients.items, unavailable: false }
  } catch {
    return { clients: [], unavailable: true }
  }
}

async function getRequestedClientSafe(
  clientId: string,
): Promise<ClientContext | null> {
  try {
    const data = await query<ClientContextQueryResponse>(CLIENT_CONTEXT_QUERY, {
      id: clientId,
    })
    return data.client
  } catch {
    return null
  }
}

async function getCarePlanningSafe(
  clientId: string,
): Promise<CarePlanningQueryResponse | null> {
  try {
    return await query<CarePlanningQueryResponse>(CARE_PLANNING_QUERY, {
      clientId,
      take: 20,
    })
  } catch {
    return null
  }
}

function formatDate(value?: string | null): string {
  return value ? formatOrganizationDate(value) : 'Not set'
}

function countKeys(value?: Record<string, unknown> | null): number {
  return value ? Object.keys(value).length : 0
}

function statusTone(status: string): StatusTone {
  if (status === 'ACTIVE' || status === 'COMPLETED') return 'success'
  if (status === 'ARCHIVED' || status === 'SUPERSEDED') return 'neutral'
  return 'attention'
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase()
}

function AssessmentList({ assessments }: { assessments: AssessmentRecord[] }) {
  if (assessments.length === 0) {
    return (
      <StatePanel title="No assessments yet">
        Create an assessment when reviewed information is ready to record for
        this client.
      </StatePanel>
    )
  }

  return (
    <div className="divide-y divide-oasis-border border-y border-oasis-border">
      {assessments.map((assessment) => (
        <article key={assessment.id} className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg font-semibold text-oasis-ink">
                {assessment.title}
              </h3>
              <p className="mt-1 text-sm text-oasis-muted">
                Created {formatDate(assessment.createdAt)} · review due{' '}
                {formatDate(assessment.reviewDueAt)}
              </p>
            </div>
            <StatusLabel tone={statusTone(assessment.status)}>
              {statusLabel(assessment.status)}
            </StatusLabel>
          </div>
          {assessment.summary ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-oasis-muted">
              {assessment.summary}
            </p>
          ) : null}
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-oasis-muted">Finding sections</dt>
              <dd className="font-semibold text-oasis-ink">
                {countKeys(assessment.findings)}
              </dd>
            </div>
            <div>
              <dt className="text-oasis-muted">Identified risks</dt>
              <dd className="font-semibold text-oasis-ink">
                {countKeys(assessment.riskFlags)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  )
}

function CarePlanList({ carePlans }: { carePlans: CarePlanRecord[] }) {
  if (carePlans.length === 0) {
    return (
      <StatePanel title="No care plans yet">
        Create a draft when the reviewed care-planning information is ready.
      </StatePanel>
    )
  }

  return (
    <div className="divide-y divide-oasis-border border-y border-oasis-border">
      {carePlans.map((plan) => (
        <article key={plan.id} className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg font-semibold text-oasis-ink">
                {plan.title}
              </h3>
              <p className="mt-1 text-sm text-oasis-muted">
                Version {plan.version} · effective{' '}
                {formatDate(plan.effectiveFrom)}
                {' · '}review due {formatDate(plan.reviewDueAt)}
              </p>
            </div>
            <StatusLabel tone={statusTone(plan.status)}>
              {statusLabel(plan.status)}
            </StatusLabel>
          </div>
          {plan.safetyNotes ? (
            <p className="mt-3 max-w-3xl border-l-4 border-oasis-attention bg-oasis-attention-soft px-3 py-2 text-sm leading-6 text-oasis-attention">
              <span className="font-semibold">Safety notes: </span>
              {plan.safetyNotes}
            </p>
          ) : null}
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
  const requestedClientParam = searchParams?.clientId
  const requestedClientInvalid = Array.isArray(requestedClientParam)
  const requestedClientId =
    typeof requestedClientParam === 'string'
      ? requestedClientParam.trim()
      : undefined
  const clientsResult = await getClientsSafe()
  const clients = clientsResult.clients
  const selectedClient = requestedClientInvalid
    ? null
    : requestedClientId
      ? await getRequestedClientSafe(requestedClientId)
      : clients[0]
  const requestedClientUnavailable =
    requestedClientInvalid || Boolean(requestedClientId && !selectedClient)
  const carePlanning = selectedClient
    ? await getCarePlanningSafe(selectedClient.id)
    : null
  const carePlanningUnavailable = Boolean(
    selectedClient && carePlanning === null,
  )
  const assessments = carePlanning?.assessments ?? []
  const carePlans = carePlanning?.carePlans ?? []

  return (
    <div className="min-h-screen bg-secondary">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="border-b border-oasis-border pb-6">
          <p className="text-sm font-semibold text-oasis-teal">Care planning</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-oasis-ink">
            Care planning
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-oasis-muted">
            Review assessments and manage care-plan versions for{' '}
            {selectedClient?.fullName ?? 'a selected client'}.
          </p>
          {selectedClient ? (
            <Link
              href={`/clients/${selectedClient.id}`}
              className="mt-4 inline-flex min-h-11 items-center font-semibold text-oasis-teal underline underline-offset-4"
            >
              Open {selectedClient.fullName}&apos;s client details
            </Link>
          ) : null}
        </header>

        {clientsResult.unavailable ? (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            headingLevel={2}
            title="Clients are unavailable"
            action={
              <form action="/care-planning" method="get">
                {requestedClientId ? (
                  <input
                    type="hidden"
                    name="clientId"
                    value={requestedClientId}
                  />
                ) : null}
                <button type="submit" className="button-primary">
                  Try again
                </button>
              </form>
            }
          >
            Client records could not be loaded. No care-planning action is
            available until the connection recovers.
          </StatePanel>
        ) : (
          <nav
            className="mt-6 border-b border-oasis-border pb-5"
            aria-label="Choose a client for care planning"
          >
            <h2 className="text-base font-semibold text-oasis-ink">
              Choose a client
            </h2>
            {clients.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {clients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/care-planning?clientId=${client.id}`}
                    aria-current={
                      selectedClient?.id === client.id ? 'page' : undefined
                    }
                    className={`inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm font-semibold ${
                      selectedClient?.id === client.id
                        ? 'border-oasis-teal bg-oasis-teal text-white'
                        : 'border-oasis-control-border bg-white text-oasis-ink'
                    }`}
                  >
                    {client.fullName}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-oasis-muted">
                Add a client before creating care-planning records.
              </p>
            )}
          </nav>
        )}

        {requestedClientUnavailable ? (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            headingLevel={2}
            title="The requested client is unavailable"
          >
            No care-planning record has been opened. Check the client link or
            choose another client.
          </StatePanel>
        ) : null}

        {carePlanningUnavailable && selectedClient ? (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            headingLevel={2}
            title={`Care-planning records for ${selectedClient.fullName} are unavailable`}
            action={
              <form action="/care-planning" method="get">
                <input
                  type="hidden"
                  name="clientId"
                  value={selectedClient.id}
                />
                <button type="submit" className="button-primary">
                  Try again
                </button>
              </form>
            }
          >
            Existing assessments and care plans could not be loaded. No changes
            can be made until the connection recovers.
          </StatePanel>
        ) : null}

        {selectedClient &&
        !clientsResult.unavailable &&
        !requestedClientUnavailable &&
        !carePlanningUnavailable ? (
          <>
            <section className="mt-8" aria-labelledby="assessments-heading">
              <h2
                id="assessments-heading"
                className="font-heading text-2xl font-bold text-oasis-ink"
              >
                Assessments and identified risks
              </h2>
              <p className="mt-2 text-sm leading-6 text-oasis-muted">
                Review recorded findings, identified risks, and review dates
                before completing an assessment.
              </p>
              <div className="mt-4">
                <AssessmentList assessments={assessments} />
              </div>
            </section>

            <section className="mt-10" aria-labelledby="care-plans-heading">
              <h2
                id="care-plans-heading"
                className="font-heading text-2xl font-bold text-oasis-ink"
              >
                Care plans
              </h2>
              <p className="mt-2 text-sm leading-6 text-oasis-muted">
                Drafts, active plans, superseded versions, and archived plans
                remain in one version history.
              </p>
              <div className="mt-4">
                <CarePlanList carePlans={carePlans} />
              </div>
            </section>

            <CarePlanningActions
              clientId={selectedClient.id}
              assessments={assessments}
              carePlans={carePlans}
              onCompleteRedirectPath={`/care-planning?clientId=${selectedClient.id}`}
            />
          </>
        ) : null}
      </main>
    </div>
  )
}
