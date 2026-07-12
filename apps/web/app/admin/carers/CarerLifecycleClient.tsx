"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientAccess } from "../../../components/providers/ClientAccessProvider";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { StatePanel } from "../../../components/ui/StatePanel";
import {
  StatusLabel,
  type StatusTone,
} from "../../../components/ui/StatusLabel";
import { clientQuery } from "../../../lib/graphql/client-side";
import {
  DEACTIVATE_CARER_MEMBERSHIP_MUTATION,
  INVITE_CARER_MUTATION,
  REISSUE_CARER_INVITATION_MUTATION,
  RETRY_CARER_INVITATION_DELIVERY_MUTATION,
  REVOKE_CARER_INVITATION_MUTATION,
  type CarerAccessLifecycleItem,
} from "../../../lib/graphql/queries";
import {
  getInvitationSavedNotice,
  getLifecycleActionNotice,
  type LifecycleAction,
  type LifecycleNotice,
} from "./carerLifecycleOutcome";

type Props = {
  initialItems: CarerAccessLifecycleItem[];
  initialError: boolean;
};

export function CarerLifecycleClient({ initialItems, initialError }: Props) {
  const router = useRouter();
  const { authenticated, getBearerToken, isAdmin } = useClientAccess();
  const [items, setItems] = useState(initialItems);
  const [loadFailed, setLoadFailed] = useState(initialError);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<LifecycleNotice | null>(null);
  const [confirmation, setConfirmation] = useState<{
    action: LifecycleAction;
    item: CarerAccessLifecycleItem;
  } | null>(null);

  useEffect(() => {
    setItems(initialItems);
    setLoadFailed(initialError);
  }, [initialError, initialItems]);

  function ensureAdmin() {
    if (!authenticated || !isAdmin) {
      setError(
        authenticated ? "Admin access is required." : "Sign in is required.",
      );
      return false;
    }
    return true;
  }

  function replaceItem(item: CarerAccessLifecycleItem) {
    setItems((current) => [
      item,
      ...current.filter((entry) => entry.lifecycleId !== item.lifecycleId),
    ]);
    setLoadFailed(false);
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!ensureAdmin()) return;
    setBusy("invite");
    setError("");
    setNotice(null);
    try {
      const result = await clientQuery<{
        inviteCarer: CarerAccessLifecycleItem;
      }>(
        INVITE_CARER_MUTATION,
        { input: { emailAddress: email } },
        { getBearerToken },
      );
      replaceItem(result.inviteCarer);
      setEmail("");
      setNotice(getInvitationSavedNotice(result.inviteCarer));
      router.refresh();
    } catch (caught) {
      setError(toSafeActionError(caught, "invite"));
    } finally {
      setBusy(null);
    }
  }

  function requestAction(
    item: CarerAccessLifecycleItem,
    action: LifecycleAction,
  ) {
    if (action === "revoke" || action === "deactivate") {
      setConfirmation({ action, item });
      return;
    }
    void act(item, action);
  }

  async function act(item: CarerAccessLifecycleItem, action: LifecycleAction) {
    if (!ensureAdmin()) return;
    if (
      (action === "revoke" || action === "reissue" || action === "retry") &&
      !item.invitationId
    ) {
      setError("This invitation action is unavailable. Refresh and retry.");
      return;
    }
    if (action === "deactivate" && !item.membershipId) {
      setError("This access action is unavailable. Refresh and retry.");
      return;
    }
    setBusy(item.lifecycleId);
    setError("");
    setNotice(null);
    try {
      let updatedItem: CarerAccessLifecycleItem;
      if (action === "revoke") {
        const result = await clientQuery<{
          revokeCarerInvitation: CarerAccessLifecycleItem;
        }>(
          REVOKE_CARER_INVITATION_MUTATION,
          { input: { invitationId: item.invitationId } },
          { getBearerToken },
        );
        updatedItem = result.revokeCarerInvitation;
      } else if (action === "reissue") {
        const result = await clientQuery<{
          reissueCarerInvitation: CarerAccessLifecycleItem;
        }>(
          REISSUE_CARER_INVITATION_MUTATION,
          { input: { invitationId: item.invitationId } },
          { getBearerToken },
        );
        updatedItem = result.reissueCarerInvitation;
      } else if (action === "retry") {
        const result = await clientQuery<{
          retryCarerInvitationDelivery: CarerAccessLifecycleItem;
        }>(
          RETRY_CARER_INVITATION_DELIVERY_MUTATION,
          { input: { invitationId: item.invitationId } },
          { getBearerToken },
        );
        updatedItem = result.retryCarerInvitationDelivery;
      } else {
        const result = await clientQuery<{
          deactivateCarerMembership: CarerAccessLifecycleItem;
        }>(
          DEACTIVATE_CARER_MEMBERSHIP_MUTATION,
          { input: { membershipId: item.membershipId } },
          { getBearerToken },
        );
        updatedItem = result.deactivateCarerMembership;
      }
      replaceItem(updatedItem);
      setNotice(getLifecycleActionNotice(action, updatedItem));
      router.refresh();
    } catch (caught) {
      setError(toSafeActionError(caught, action));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Card
        id="carer-access"
        className="scroll-mt-24"
        data-testid="carer-lifecycle-panel"
        aria-labelledby="carer-access-title"
      >
        <CardHeader>
          <h2
            id="carer-access-title"
            className="text-xl font-semibold text-oasis-ink"
          >
            Invite and manage access
          </h2>
          <p className="mt-1 text-sm leading-6 text-oasis-muted">
            Invite a workforce login, track acceptance and resolve access before
            linking a profile.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            onSubmit={invite}
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
          >
            <div>
              <label
                htmlFor="carer-invite-email"
                className="block text-sm font-semibold text-oasis-ink"
              >
                Carer email{" "}
                <span className="font-normal text-oasis-muted">(required)</span>
              </label>
              <input
                id="carer-invite-email"
                className="mt-1"
                type="email"
                autoComplete="email"
                required
                maxLength={320}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby="carer-invite-help"
              />
              <p
                id="carer-invite-help"
                className="mt-1 text-xs leading-5 text-oasis-muted"
              >
                Oasis sends an organisation-bound invitation with the Carer role
                fixed by the service.
              </p>
            </div>
            <Button
              type="submit"
              disabled={busy !== null || !authenticated || !isAdmin}
            >
              {busy === "invite" ? "Sending invitation…" : "Invite Carer"}
            </Button>
          </form>

          {error && (
            <Alert tone="danger" live>
              {error}
            </Alert>
          )}
          {notice && (
            <Alert tone={notice.tone} live>
              {notice.message}
            </Alert>
          )}

          {items.length === 0 && loadFailed ? (
            <StatePanel
              kind="unavailable"
              title="Access records unavailable"
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.refresh()}
                >
                  Try again
                </Button>
              }
            >
              Carer access records could not be loaded. No empty-state
              assumptions have been made.
            </StatePanel>
          ) : items.length === 0 ? (
            <StatePanel title="No invitations yet">
              Send the first Carer invitation using the email field above.
            </StatePanel>
          ) : (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Carer invitations and access actions"
              aria-busy={busy !== null}
              tabIndex={0}
            >
              <table className="oasis-table min-w-[720px] w-full text-sm">
                <caption className="sr-only">
                  Carer invitations and access readiness
                </caption>
                <thead>
                  <tr className="border-b border-oasis-border text-left">
                    <th scope="col" className="px-3 py-3">
                      Login
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Expiry
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.lifecycleId}
                      className="border-b border-oasis-border align-top last:border-b-0"
                    >
                      <td className="px-3 py-4 font-medium text-oasis-ink">
                        {item.emailAddress}
                      </td>
                      <td className="px-3 py-4">
                        <StatusLabel tone={statusTone(item)}>
                          {statusLabel(item)}
                        </StatusLabel>
                        {deliveryMessage(item) && (
                          <InlineAttention>
                            {deliveryMessage(item)}
                          </InlineAttention>
                        )}
                        {cleanupMessage(item) && (
                          <InlineAttention>
                            {cleanupMessage(item)}
                          </InlineAttention>
                        )}
                      </td>
                      <td className="px-3 py-4 text-oasis-muted">
                        {item.expiresAt &&
                        (item.status === "PENDING" ||
                          item.status === "EXPIRED") ? (
                          <time dateTime={item.expiresAt}>
                            {formatLifecycleDate(item.expiresAt)}
                          </time>
                        ) : (
                          "Not applicable"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {item.canRevoke && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                busy !== null || !authenticated || !isAdmin
                              }
                              onClick={() => requestAction(item, "revoke")}
                            >
                              Revoke
                            </Button>
                          )}
                          {item.canReissue && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                busy !== null || !authenticated || !isAdmin
                              }
                              onClick={() => requestAction(item, "reissue")}
                            >
                              Send new invitation
                            </Button>
                          )}
                          {item.canRetryDelivery && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                busy !== null || !authenticated || !isAdmin
                              }
                              onClick={() => requestAction(item, "retry")}
                            >
                              Retry delivery
                            </Button>
                          )}
                          {item.canDeactivate && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                busy !== null || !authenticated || !isAdmin
                              }
                              onClick={() => requestAction(item, "deactivate")}
                            >
                              Deactivate
                            </Button>
                          )}
                          {item.canLink && (
                            <span className="self-center text-xs font-semibold text-oasis-teal-dark">
                              Link profile in the next panel
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmation !== null}
        title={
          confirmation?.action === "revoke"
            ? "Revoke this invitation?"
            : "Deactivate Carer access?"
        }
        description={
          confirmation
            ? confirmation.action === "revoke"
              ? `The pending invitation for ${confirmation.item.emailAddress} will no longer be usable.`
              : `${confirmation.item.emailAddress} will lose access and cannot be assigned new work.`
            : ""
        }
        confirmLabel={
          confirmation?.action === "revoke"
            ? "Revoke invitation"
            : "Deactivate access"
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          const pending = confirmation;
          setConfirmation(null);
          void act(pending.item, pending.action);
        }}
      />
    </>
  );
}

function InlineAttention({ children }: { children: string }) {
  return (
    <p className="mt-2 flex gap-1.5 text-xs leading-5 text-oasis-attention">
      <span aria-hidden="true">!</span>
      <span>{children}</span>
    </p>
  );
}

function statusLabel(item: CarerAccessLifecycleItem) {
  if (item.readiness === "READY") return "Active — ready for assignment";
  if (item.readiness === "LINK_REQUIRED")
    return "Active — profile link required";
  if (item.readiness === "BLOCKED") return "Active — profile needs review";
  if (item.status === "PENDING") return "Pending — awaiting acceptance";
  if (item.status === "EXPIRED") return "Expired";
  return "Revoked — access disabled";
}

function statusTone(item: CarerAccessLifecycleItem): StatusTone {
  if (item.readiness === "READY") return "success";
  if (item.readiness === "BLOCKED" || item.status === "REVOKED")
    return "danger";
  if (item.readiness === "LINK_REQUIRED" || item.status === "EXPIRED")
    return "attention";
  if (item.status === "PENDING") return "info";
  return "neutral";
}

function deliveryMessage(item: CarerAccessLifecycleItem) {
  if (item.status !== "PENDING") return "";
  if (item.deliveryStatus === "PENDING") return "Queued for secure delivery";
  if (item.deliveryStatus === "PROCESSING")
    return "Secure delivery in progress";
  if (item.deliveryStatus === "RETRYABLE") return "Delivery can be retried";
  if (
    item.deliveryStatus === "NEEDS_ATTENTION" ||
    item.deliveryStatus === "UNAVAILABLE"
  )
    return "Delivery needs administrator support";
  return "";
}

function cleanupMessage(item: CarerAccessLifecycleItem) {
  if (item.cleanupStatus === "PENDING")
    return "Provider access cleanup is still in progress";
  if (item.cleanupStatus === "MANUAL_REVIEW")
    return "Provider access cleanup needs administrator support";
  return "";
}

function formatLifecycleDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toSafeActionError(error: unknown, action: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("manual access review"))
    return "This account needs manual access review before another invitation can be sent.";
  if (message.includes("different access invitation"))
    return "A different access invitation is already pending for this email.";
  if (message.includes("delivery cannot be retried"))
    return "Delivery is no longer retryable. Refresh the lifecycle before continuing.";
  if (message.includes("state changed") || message.includes("no longer"))
    return "Carer access changed while this action was running. Refresh and try again.";
  return action === "invite"
    ? "The Carer invitation could not be saved safely. Retry or contact support."
    : "Carer access could not be updated safely. Refresh and retry.";
}
