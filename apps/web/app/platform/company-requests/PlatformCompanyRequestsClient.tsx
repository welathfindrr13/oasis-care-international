"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
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
  bootstrapManagerEmail?: string;
  bootstrapManagerAccessStatus: "ACTIVE" | "REVOKED" | "UNAVAILABLE";
  bootstrapManagerCleanupStatus:
    | "NOT_REQUIRED"
    | "PENDING"
    | "COMPLETE"
    | "NEEDS_ATTENTION";
  bootstrapManagerCleanupErrorCode?: string;
  requestedAt: string;
};

type OperationError = {
  message: string;
  targetId: string;
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
  bootstrapManagerEmail
  bootstrapManagerAccessStatus
  bootstrapManagerCleanupStatus
  bootstrapManagerCleanupErrorCode
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
  const [error, setError] = useState<OperationError | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmRevocation, setConfirmRevocation] =
    useState<PlatformRequest | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function run(
    id: string,
    mutation: string,
    variables: Record<string, unknown>,
    options: {
      errorMessage?: string;
      errorTargetId?: string;
      successMessage?: (updated: PlatformRequest) => string;
    } = {},
  ) {
    setWorkingId(id);
    setError(null);
    setNotice("");
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
      if (options.successMessage) {
        setNotice(options.successMessage(updated));
      }
      router.refresh();
    } catch {
      setError({
        message:
          options.errorMessage ||
          "The platform action could not be completed. Check the latest state and try again.",
        targetId: options.errorTargetId || "company-requests-heading",
      });
    } finally {
      setWorkingId("");
    }
  }

  function runBootstrapManagerAction(
    item: PlatformRequest,
    action: "revoke" | "retry",
  ) {
    setConfirmRevocation(null);
    void run(
      item.id,
      `mutation RevokeBootstrapManager($id: String!) { revokeBootstrapManagerAccess(id: $id) { ${REQUEST_FIELDS} } }`,
      { id: item.id },
      {
        errorMessage:
          action === "retry"
            ? "We could not retry Clerk cleanup. Oasis access remains revoked. Check the latest state and try again."
            : "We could not revoke this first Manager safely. No replacement Manager was created. Check the latest state and try again.",
        errorTargetId: `bootstrap-manager-${item.id}`,
        successMessage: (updated) =>
          action === "retry"
            ? updated.bootstrapManagerCleanupStatus === "COMPLETE"
              ? `Clerk cleanup completed for ${updated.companyName}.`
              : `Oasis access remains revoked for ${updated.companyName}. Clerk cleanup still needs attention.`
            : updated.bootstrapManagerCleanupStatus === "COMPLETE"
              ? `First Manager access revoked for ${updated.companyName}. Clerk cleanup completed.`
              : `First Manager access revoked for ${updated.companyName}. Clerk cleanup still needs attention.`,
      },
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="rounded-md border-2 border-oasis-danger bg-oasis-danger-soft p-4 text-sm text-oasis-danger outline-none"
          role="alert"
        >
          <p className="font-semibold">There is a problem</p>
          <a className="mt-2 block underline" href={`#${error.targetId}`}>
            {error.message}
          </a>
        </div>
      )}
      {notice && (
        <Alert live tone="success" title="Company access updated">
          {notice}
        </Alert>
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

          {item.bootstrapManagerEmail &&
            item.bootstrapManagerAccessStatus !== "UNAVAILABLE" && (
              <section
                id={`bootstrap-manager-${item.id}`}
                tabIndex={-1}
                aria-labelledby={`bootstrap-manager-heading-${item.id}`}
                className="mt-5 rounded-md border border-oasis-border bg-oasis-canvas p-4 outline-none"
              >
                <h3
                  id={`bootstrap-manager-heading-${item.id}`}
                  className="font-heading text-lg font-semibold text-oasis-ink"
                >
                  First Manager access
                </h3>
                <p className="mt-2 break-all text-sm text-oasis-muted">
                  {item.bootstrapManagerEmail}
                </p>

                {item.bootstrapManagerAccessStatus === "ACTIVE" ? (
                  <>
                    <p className="mt-3 text-sm leading-6 text-oasis-ink">
                      Access is active. Revoking it stops this Manager&apos;s
                      Oasis authority immediately. The company and care records
                      will remain.
                    </p>
                    <Button
                      id={`bootstrap-revoke-${item.id}`}
                      className="mt-4"
                      variant="danger"
                      disabled={workingId === item.id}
                      onClick={() => setConfirmRevocation(item)}
                    >
                      {workingId === item.id
                        ? "Revoking…"
                        : "Revoke first Manager"}
                    </Button>
                  </>
                ) : (
                  <>
                    {item.bootstrapManagerCleanupStatus === "COMPLETE" ? (
                      <Alert
                        className="mt-3"
                        tone="success"
                        title="Access revoked"
                      >
                        Oasis access is revoked and Clerk cleanup is complete.
                      </Alert>
                    ) : item.bootstrapManagerCleanupStatus ===
                      "NEEDS_ATTENTION" ? (
                      <Alert
                        className="mt-3"
                        tone="attention"
                        title="Cleanup needs attention"
                      >
                        <p>
                          Oasis access is revoked. Clerk cleanup still needs
                          attention and cannot restore application authority.
                        </p>
                        {item.bootstrapManagerCleanupErrorCode ? (
                          <p className="mt-2 break-all font-mono text-xs">
                            Safe code: {item.bootstrapManagerCleanupErrorCode}
                          </p>
                        ) : null}
                      </Alert>
                    ) : (
                      <Alert
                        className="mt-3"
                        tone="attention"
                        title="Cleanup in progress"
                      >
                        Oasis access is revoked while Clerk cleanup is being
                        completed.
                      </Alert>
                    )}
                    <p className="mt-3 text-sm leading-6 text-oasis-muted">
                      No replacement Manager was created. A Platform Owner must
                      appoint one separately.
                    </p>
                    {item.bootstrapManagerCleanupStatus ===
                    "NEEDS_ATTENTION" ? (
                      <Button
                        className="mt-4"
                        variant="secondary"
                        disabled={workingId === item.id}
                        onClick={() => runBootstrapManagerAction(item, "retry")}
                      >
                        {workingId === item.id
                          ? "Retrying Clerk cleanup…"
                          : "Retry Clerk cleanup"}
                      </Button>
                    ) : null}
                  </>
                )}
              </section>
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
      <ConfirmDialog
        open={Boolean(confirmRevocation)}
        title={
          confirmRevocation?.bootstrapManagerEmail
            ? `Revoke access for ${confirmRevocation.bootstrapManagerEmail}?`
            : "Revoke first Manager access?"
        }
        description={
          confirmRevocation
            ? `This stops the first Manager's access to ${confirmRevocation.companyName} immediately. The company and care records will remain. No replacement Manager will be created. A Platform Owner must appoint one separately.`
            : ""
        }
        confirmLabel="Revoke first Manager"
        returnFocusId="company-requests-heading"
        onCancel={() => setConfirmRevocation(null)}
        onConfirm={() => {
          if (confirmRevocation) {
            runBootstrapManagerAction(confirmRevocation, "revoke");
          }
        }}
      />
    </div>
  );
}
