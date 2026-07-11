import Link from "next/link";
import { Header } from "../../../components/oasis/Header";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { StatePanel } from "../../../components/ui/StatePanel";
import { StatusLabel } from "../../../components/ui/StatusLabel";
import { query } from "../../../lib/graphql/client";
import {
  CARERS_QUERY,
  CARER_ACCESS_LIFECYCLE_QUERY,
  ELIGIBLE_CARER_MEMBERSHIPS_QUERY,
  SHIFT_ANALYTICS_QUERY,
  type CarersQueryResponse,
  type CarerAccessLifecycleQueryResponse,
  type EligibleCarerMembershipsQueryResponse,
  type ShiftAnalyticsQueryResponse,
} from "../../../lib/graphql/queries";
import { CarerMembershipLinkForm } from "./CarerMembershipLinkForm";
import { CarerLifecycleClient } from "./CarerLifecycleClient";

export const dynamic = "force-dynamic";

async function getCarers() {
  try {
    const response = await query<CarersQueryResponse>(CARERS_QUERY);
    return { carers: response.carers, unavailable: false };
  } catch {
    return { carers: [], unavailable: true };
  }
}

async function getShiftAnalytics() {
  try {
    const response = await query<ShiftAnalyticsQueryResponse>(
      SHIFT_ANALYTICS_QUERY,
    );
    return { analytics: response.shiftAnalytics, unavailable: false };
  } catch {
    return { analytics: null, unavailable: true };
  }
}

async function getEligibleMemberships() {
  try {
    const response = await query<EligibleCarerMembershipsQueryResponse>(
      ELIGIBLE_CARER_MEMBERSHIPS_QUERY,
    );
    return {
      memberships: response.eligibleCarerMemberships,
      error: null as string | null,
    };
  } catch {
    return {
      memberships: [],
      error: "Eligible workforce logins could not be loaded.",
    };
  }
}

async function getLifecycle() {
  try {
    const response = await query<CarerAccessLifecycleQueryResponse>(
      CARER_ACCESS_LIFECYCLE_QUERY,
    );
    return { items: response.carerAccessLifecycle, error: false };
  } catch {
    return { items: [], error: true };
  }
}

export default async function AdminCarersPage() {
  const [directory, shift, eligible, lifecycle] = await Promise.all([
    getCarers(),
    getShiftAnalytics(),
    getEligibleMemberships(),
    getLifecycle(),
  ]);

  return (
    <div className="min-h-screen bg-oasis-canvas">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-oasis-border pb-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-oasis-teal">
              Workforce
            </p>
            <h1 className="mt-2 text-oasis-ink">Carers and access</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-oasis-muted sm:text-base">
              Invite workforce logins, link verified Carer profiles and keep
              assignment readiness clear.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="secondary">
              <Link href="/admin/analytics">Workforce insights</Link>
            </Button>
            <Button asChild>
              <Link href="/schedule">Open schedule</Link>
            </Button>
          </div>
        </header>

        <dl
          className="oasis-panel mt-6 grid divide-y divide-oasis-border sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          aria-label="Workforce summary"
        >
          <SummaryMetric
            label="On shift now"
            value={shift.analytics?.activeCarersNow ?? null}
            unavailable={shift.unavailable}
          />
          <SummaryMetric
            label="Open shifts"
            value={shift.analytics?.openShiftCount ?? null}
            unavailable={shift.unavailable}
          />
          <SummaryMetric
            label="Directory records"
            value={directory.unavailable ? null : directory.carers.length}
            unavailable={directory.unavailable}
          />
        </dl>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)] xl:items-start">
          <CarerLifecycleClient
            initialItems={lifecycle.items}
            initialError={lifecycle.error}
          />
          <CarerMembershipLinkForm
            initialMemberships={eligible.memberships}
            initialError={eligible.error}
          />
        </div>

        <Card className="mt-6" data-testid="carer-directory-panel">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-oasis-ink">
                Assignable carers
              </h2>
              <p className="mt-1 text-sm text-oasis-muted">
                Profiles available to scheduling and shift workflows.
              </p>
            </div>
            {!directory.unavailable && directory.carers.length > 0 && (
              <StatusLabel tone="success">
                {directory.carers.length} ready
              </StatusLabel>
            )}
          </CardHeader>
          <CardContent>
            {directory.unavailable ? (
              <StatePanel
                kind="unavailable"
                title="Carer directory unavailable"
                action={
                  <form action="/admin/carers" method="get">
                    <Button type="submit" variant="secondary">
                      Try again
                    </Button>
                  </form>
                }
              >
                The live directory could not be loaded. No empty-state
                assumptions have been made.
              </StatePanel>
            ) : directory.carers.length === 0 ? (
              <StatePanel
                title="No linked carers yet"
                action={
                  <Button asChild variant="secondary">
                    <Link href="#carer-access">Invite a Carer</Link>
                  </Button>
                }
              >
                Start with a workforce invitation, then link the accepted login
                to a Carer profile.
              </StatePanel>
            ) : (
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Assignable carers directory"
                tabIndex={0}
              >
                <table className="oasis-table min-w-[640px] w-full text-sm">
                  <caption className="sr-only">
                    Carers ready for visit assignment
                  </caption>
                  <thead>
                    <tr className="border-b border-oasis-border text-left">
                      <th scope="col" className="px-3 py-3">
                        Carer
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Contact
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Assignment status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {directory.carers.map((carer) => (
                      <tr
                        key={carer.id}
                        className="border-b border-oasis-border align-top last:border-b-0"
                      >
                        <td className="px-3 py-4 font-semibold text-oasis-ink">
                          {carer.firstName} {carer.lastName}
                        </td>
                        <td className="px-3 py-4 text-oasis-muted">
                          <span className="block">
                            {carer.email || "Email not recorded"}
                          </span>
                          <span className="mt-1 block text-xs">
                            {carer.phone || "Phone not recorded"}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <StatusLabel tone="success">
                            Ready for assignment
                          </StatusLabel>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="mt-6 border-l-4 border-oasis-teal px-4 py-1 text-sm leading-6 text-oasis-muted">
          <p className="font-semibold text-oasis-ink">Identity safety</p>
          <p className="mt-1">
            Login identity is selected explicitly from active, unlinked
            workforce memberships. Profile email is contact data only and is
            never used to choose an account.
          </p>
        </aside>
      </main>
    </div>
  );
}

function SummaryMetric({
  label,
  unavailable,
  value,
}: {
  label: string;
  unavailable: boolean;
  value: number | null;
}) {
  return (
    <div className="px-5 py-4">
      <dt className="text-sm font-medium text-oasis-muted">{label}</dt>
      <dd className="mt-1 flex min-h-9 items-center">
        {unavailable || value === null ? (
          <StatusLabel tone="attention">Unavailable</StatusLabel>
        ) : (
          <span className="text-2xl font-bold tabular-nums text-oasis-ink">
            {value}
          </span>
        )}
      </dd>
    </div>
  );
}
