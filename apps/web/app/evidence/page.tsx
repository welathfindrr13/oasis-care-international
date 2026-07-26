import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Header } from '../../components/oasis/Header'
import { InspectionRecordActions } from '../../components/evidence/InspectionRecordActions'
import { StatePanel } from '../../components/ui/StatePanel'
import { StatusLabel, type StatusTone } from '../../components/ui/StatusLabel'
import { hasAccessCapability } from '../../lib/auth/capabilities'
import { getServerAuthContext } from '../../lib/auth/server-auth'
import { query } from '../../lib/graphql/client'
import {
  CLIENT_CONTEXT_QUERY,
  CLIENT_CONTEXTS_QUERY,
  INSPECTION_RECORDS_QUERY,
  type ClientContext,
  type ClientContextQueryResponse,
  type ClientContextsQueryResponse,
  type InspectionRecord,
  type InspectionRecordsQueryResponse,
} from '../../lib/graphql/queries'
import {
  groupInspectionRecordItems,
  inspectionRecordTypeLabel,
  shouldShowRequestedClientUnavailable,
} from '../../lib/inspection-records'
import { formatDate, formatStoredCalendarDate } from '../../lib/time'

export const dynamic = 'force-dynamic'

interface EvidencePageProps {
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

async function getInspectionRecordsSafe(
  clientId: string,
): Promise<InspectionRecordsQueryResponse | null> {
  try {
    return await query<InspectionRecordsQueryResponse>(
      INSPECTION_RECORDS_QUERY,
      { clientId, take: 20 },
    )
  } catch {
    return null
  }
}

function statusTone(status: string): StatusTone {
  if (status === 'PUBLISHED' || status === 'COMPILED') return 'success'
  if (status === 'DRAFT') return 'attention'
  return 'neutral'
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase()
}

function InspectionRecordList({
  records,
  clientName,
}: {
  records: InspectionRecord[]
  clientName: string
}) {
  if (records.length === 0) {
    return (
      <StatePanel title="No inspection records yet">
        Create a record when you need to prepare selected information for this
        client.
      </StatePanel>
    )
  }

  return (
    <div className="divide-y divide-oasis-border border-y border-oasis-border">
      {records.map((record) => {
        const groups = groupInspectionRecordItems(record.items)
        return (
          <article key={record.id} className="py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-lg font-semibold text-oasis-ink">
                  {clientName}: {formatStoredCalendarDate(record.periodStart)}{' '}
                  to {formatStoredCalendarDate(record.periodEnd)}
                </h3>
                <p className="mt-1 text-sm text-oasis-muted">
                  Created {formatDate(record.generatedAt)}
                  {record.publishedAt
                    ? ` · published ${formatDate(record.publishedAt)}`
                    : ''}
                </p>
              </div>
              <StatusLabel tone={statusTone(record.status)}>
                {statusLabel(record.status)}
              </StatusLabel>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-oasis-ink">
                Included records
              </h4>
              {groups.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-oasis-muted">
                  {groups.map((group) => (
                    <li key={group.sourceType}>
                      <span className="font-semibold text-oasis-ink">
                        {inspectionRecordTypeLabel(group.sourceType)}
                      </span>{' '}
                      {group.count}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-oasis-muted">
                  No record items have been included yet.
                </p>
              )}
            </div>

            <Link
              href={`/api/evidence-packs/${record.id}/export`}
              className="mt-4 inline-flex min-h-11 items-center rounded-md border border-oasis-control-border bg-white px-4 py-2 text-sm font-semibold text-oasis-ink"
            >
              Download inspection record
            </Link>
          </article>
        )
      })}
    </div>
  )
}

export default async function EvidencePage(props: EvidencePageProps) {
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
  const requestedClientUnavailable = shouldShowRequestedClientUnavailable({
    clientListUnavailable: clientsResult.unavailable,
    requestedClientInvalid,
    requestedClientId,
    selectedClientAvailable: Boolean(selectedClient),
  })
  const inspectionData = selectedClient
    ? await getInspectionRecordsSafe(selectedClient.id)
    : null
  const recordsUnavailable = Boolean(selectedClient && inspectionData === null)
  const assessments = inspectionData?.assessments ?? []
  const carePlans = inspectionData?.carePlans ?? []
  const records = inspectionData?.evidencePacks ?? []

  return (
    <div className="min-h-screen bg-secondary">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="border-b border-oasis-border pb-6">
          <p className="text-sm font-semibold text-oasis-teal">
            Inspection records
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-oasis-ink">
            Inspection records
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-oasis-muted">
            Prepare selected records for{' '}
            {selectedClient?.fullName ?? 'a client'}. These records support
            inspection preparation but do not guarantee an inspection outcome.
          </p>
        </header>

        {clientsResult.unavailable ? (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            headingLevel={2}
            title="Clients are unavailable"
            action={
              <form action="/evidence" method="get">
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
            Client records could not be loaded. No inspection record can be
            created until the connection recovers.
          </StatePanel>
        ) : (
          <nav
            className="mt-6 border-b border-oasis-border pb-5"
            aria-label="Choose a client for inspection records"
          >
            <h2 className="text-base font-semibold text-oasis-ink">
              Choose a client
            </h2>
            {clients.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {clients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/evidence?clientId=${client.id}`}
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
                Add a client before creating an inspection record.
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
            No inspection record has been opened. Check the client link or
            choose another client.
          </StatePanel>
        ) : null}

        {recordsUnavailable && selectedClient ? (
          <StatePanel
            className="mt-6"
            kind="unavailable"
            headingLevel={2}
            title={`Inspection records for ${selectedClient.fullName} are unavailable`}
            action={
              <form action="/evidence" method="get">
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
            Existing records and available source types could not be loaded. No
            changes can be made until the connection recovers.
          </StatePanel>
        ) : null}

        {selectedClient &&
        !clientsResult.unavailable &&
        !requestedClientUnavailable &&
        !recordsUnavailable ? (
          <>
            <section
              className="mt-8"
              aria-labelledby="existing-records-heading"
            >
              <h2
                id="existing-records-heading"
                className="font-heading text-2xl font-bold text-oasis-ink"
              >
                Existing inspection records
              </h2>
              <p className="mt-2 text-sm leading-6 text-oasis-muted">
                Each record shows the client, covered period, included record
                types, current state, and download action.
              </p>
              <div className="mt-4">
                <InspectionRecordList
                  records={records}
                  clientName={selectedClient.fullName}
                />
              </div>
            </section>

            <InspectionRecordActions
              key={selectedClient.id}
              clientId={selectedClient.id}
              assessments={assessments}
              carePlans={carePlans}
              onCompleteRedirectPath={`/evidence?clientId=${selectedClient.id}`}
            />
          </>
        ) : null}
      </main>
    </div>
  )
}
