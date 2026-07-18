import Link from "next/link";
import { query } from "../../../lib/graphql/client";
import {
  PlatformCompanyRequestsClient,
  PlatformRequest,
} from "./PlatformCompanyRequestsClient";

const COMPANY_REQUESTS = `
  query CompanyRequests(
    $status: PlatformCompanyAccessRequestStatus!
    $offset: Int!
    $limit: Int!
  ) {
    companyAccessRequests(status: $status, offset: $offset, limit: $limit) {
      items {
        id
        companyName
        contactName
        businessEmail
        operationalNote
        status
        organizationId
        provisioningStatus
        provisioningAttemptCount
        provisioningErrorCode
        bootstrapManagerEmail
        bootstrapManagerAccessStatus
        bootstrapManagerCleanupStatus
        bootstrapManagerCleanupErrorCode
        requestedAt
      }
      total
      offset
      limit
    }
  }
`;

const STATUSES = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "DISABLED",
] as const;
const PAGE_SIZE = 50;

type CompanyRequestStatus = (typeof STATUSES)[number];

function selectedStatus(value?: string): CompanyRequestStatus {
  return STATUSES.includes(value as CompanyRequestStatus)
    ? (value as CompanyRequestStatus)
    : "PENDING_APPROVAL";
}

function selectedOffset(value?: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return Math.min(Math.floor(parsed / PAGE_SIZE) * PAGE_SIZE, 10_000);
}

function requestsHref(status: CompanyRequestStatus, offset = 0): string {
  const params = new URLSearchParams({ status });
  if (offset > 0) params.set("offset", String(offset));
  return `/platform/company-requests?${params.toString()}`;
}

export const dynamic = "force-dynamic";

export default async function PlatformCompanyRequestsPage(props: {
  searchParams?: Promise<{ status?: string; offset?: string }>;
}) {
  const searchParams = await props.searchParams;
  const status = selectedStatus(searchParams?.status);
  const offset = selectedOffset(searchParams?.offset);
  const data = await query<{
    companyAccessRequests: {
      items: PlatformRequest[];
      total: number;
      offset: number;
      limit: number;
    };
  }>(COMPANY_REQUESTS, { status, offset, limit: PAGE_SIZE });
  const page = data.companyAccessRequests;
  const previousOffset = Math.max(0, page.offset - page.limit);
  const nextOffset = page.offset + page.limit;
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-800">
          Oasis platform operations
        </p>
        <h1
          id="company-requests-heading"
          tabIndex={-1}
          className="font-heading text-4xl font-black tracking-tight"
        >
          Company access requests
        </h1>
        <p className="mb-8 max-w-3xl text-slate-600">
          Approvals create a pending Oasis organization bootstrap and a
          recoverable Clerk invitation. They do not create an active tenant
          membership.
        </p>
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Request status">
          {STATUSES.map((candidate) => (
            <Link
              key={candidate}
              href={requestsHref(candidate)}
              aria-current={candidate === status ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                candidate === status
                  ? "bg-slate-950 text-white"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              {candidate.replaceAll("_", " ")}
            </Link>
          ))}
        </nav>
        <p className="mb-4 text-sm text-slate-600">
          Showing {page.items.length === 0 ? 0 : page.offset + 1}–
          {Math.min(page.offset + page.items.length, page.total)} of{" "}
          {page.total}
        </p>
        <PlatformCompanyRequestsClient
          key={`${status}:${page.offset}`}
          initialItems={page.items}
        />
        <nav
          className="mt-6 flex items-center justify-between"
          aria-label="Request pages"
        >
          {page.offset > 0 ? (
            <Link
              href={requestsHref(status, previousOffset)}
              className="text-sm font-bold text-teal-800"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {nextOffset < page.total && nextOffset <= 10_000 ? (
            <Link
              href={requestsHref(status, nextOffset)}
              className="text-sm font-bold text-teal-800"
            >
              Next →
            </Link>
          ) : null}
        </nav>
      </div>
    </main>
  );
}
