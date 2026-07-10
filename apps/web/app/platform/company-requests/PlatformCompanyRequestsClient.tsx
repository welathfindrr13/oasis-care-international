"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clientQuery } from "../../../lib/graphql/client-side";

export type PlatformRequest = {
  id: string;
  companyName: string;
  contactName: string;
  businessEmail: string;
  operationalNote?: string;
  status: string;
  organizationId?: string;
  provisioningStatus?: string;
  provisioningAttemptCount?: number;
  provisioningErrorCode?: string;
  requestedAt: string;
};

const REQUEST_FIELDS = `
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
  requestedAt
`;

export function PlatformCompanyRequestsClient({
  initialItems,
}: {
  initialItems: PlatformRequest[];
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  async function run(
    id: string,
    mutation: string,
    variables: Record<string, unknown>,
  ) {
    setWorkingId(id);
    setError("");
    try {
      const data = await clientQuery<Record<string, PlatformRequest>>(
        mutation,
        variables,
        {
          getBearerToken: getToken,
          headers: { "X-Oasis-Platform-Action": "1" },
        },
      );
      const updated = Object.values(data)[0];
      setItems((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The platform action failed.",
      );
    } finally {
      setWorkingId("");
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <p
          className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      {items.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-600">
          There are no company access requests with this status.
        </div>
      )}
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-teal-800">
                {item.status.replaceAll("_", " ")}
              </p>
              <h2 className="font-heading text-2xl font-black text-slate-950">
                {item.companyName}
              </h2>
              <p className="mb-1 text-sm text-slate-700">
                {item.contactName} · {item.businessEmail}
              </p>
              <p className="mb-0 text-xs text-slate-500">
                Submitted {new Date(item.requestedAt).toLocaleString()}
              </p>
            </div>
            <div className="text-sm text-slate-600 md:text-right">
              <p className="mb-1">
                <strong>Provisioning:</strong>{" "}
                {item.provisioningStatus || "Not started"}
              </p>
              {typeof item.provisioningAttemptCount === "number" && (
                <p className="mb-1">
                  <strong>Attempts:</strong> {item.provisioningAttemptCount}
                </p>
              )}
              {item.provisioningErrorCode && (
                <p className="mb-0 font-mono text-xs">
                  <strong>Safe code:</strong> {item.provisioningErrorCode}
                </p>
              )}
            </div>
          </div>

          {item.operationalNote && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <strong>Operational note</strong>
              <p className="mb-0 mt-1 whitespace-pre-wrap">
                {item.operationalNote}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {item.status === "PENDING_APPROVAL" && (
              <>
                <button
                  className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  disabled={workingId === item.id}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Approve ${item.companyName} and begin the administrator invitation?`,
                      )
                    )
                      return;
                    void run(
                      item.id,
                      `mutation Approve($id: String!) { approveCompanyAccessRequest(id: $id) { ${REQUEST_FIELDS} } }`,
                      { id: item.id },
                    );
                  }}
                >
                  Approve
                </button>
                <button
                  className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50"
                  disabled={workingId === item.id}
                  onClick={() => {
                    if (!window.confirm(`Reject ${item.companyName}?`)) return;
                    void run(
                      item.id,
                      `mutation Reject($id: String!) { rejectCompanyAccessRequest(id: $id, rejectionCode: NOT_ELIGIBLE) { ${REQUEST_FIELDS} } }`,
                      { id: item.id },
                    );
                  }}
                >
                  Reject
                </button>
              </>
            )}
            {item.status === "APPROVED" &&
              (item.provisioningStatus === "PROCESSING" ||
                item.provisioningStatus === "RETRYABLE" ||
                item.provisioningStatus === "NEEDS_ATTENTION") && (
                <button
                  className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  disabled={workingId === item.id}
                  onClick={() =>
                    void run(
                      item.id,
                      `mutation Retry($id: String!) { retryCompanyProvisioning(id: $id) { ${REQUEST_FIELDS} } }`,
                      { id: item.id },
                    )
                  }
                >
                  Retry provisioning
                </button>
              )}
          </div>
        </article>
      ))}
    </div>
  );
}
