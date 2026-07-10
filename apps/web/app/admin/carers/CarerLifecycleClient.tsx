"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientAccess } from "../../../components/providers/ClientAccessProvider";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { clientQuery } from "../../../lib/graphql/client-side";
import {
  DEACTIVATE_CARER_MEMBERSHIP_MUTATION,
  INVITE_CARER_MUTATION,
  REISSUE_CARER_INVITATION_MUTATION,
  RETRY_CARER_INVITATION_DELIVERY_MUTATION,
  REVOKE_CARER_INVITATION_MUTATION,
  type CarerAccessLifecycleItem,
} from "../../../lib/graphql/queries";

type Props = {
  initialItems: CarerAccessLifecycleItem[];
  initialError: boolean;
};

export function CarerLifecycleClient({ initialItems, initialError }: Props) {
  const router = useRouter();
  const { authenticated, getBearerToken, isAdmin } = useClientAccess();
  const [items, setItems] = useState(initialItems);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(
    initialError ? "Carer access records could not be loaded." : "",
  );
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setItems(initialItems);
    setError(initialError ? "Carer access records could not be loaded." : "");
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
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!ensureAdmin()) return;
    setBusy("invite");
    setError("");
    setSuccess("");
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
      setSuccess(invitationSavedMessage(result.inviteCarer));
      router.refresh();
    } catch (caught) {
      setError(toSafeActionError(caught, "invite"));
    } finally {
      setBusy(null);
    }
  }

  async function act(
    item: CarerAccessLifecycleItem,
    action: "revoke" | "reissue" | "retry" | "deactivate",
  ) {
    if (!ensureAdmin()) return;
    if (
      (action === "revoke" || action === "reissue" || action === "retry") &&
      !item.invitationId
    ) {
      setError("This invitation action is unavailable. Refresh and retry.");
      return;
    }
    if (
      (action === "revoke" || action === "deactivate") &&
      !window.confirm(
        action === "revoke"
          ? "Revoke this pending invitation?"
          : "Deactivate this Carer access?",
      )
    )
      return;
    setBusy(item.lifecycleId);
    setError("");
    setSuccess("");
    try {
      if (action === "revoke") {
        const result = await clientQuery<{
          revokeCarerInvitation: CarerAccessLifecycleItem;
        }>(
          REVOKE_CARER_INVITATION_MUTATION,
          { input: { invitationId: item.invitationId } },
          { getBearerToken },
        );
        replaceItem(result.revokeCarerInvitation);
      } else if (action === "reissue") {
        const result = await clientQuery<{
          reissueCarerInvitation: CarerAccessLifecycleItem;
        }>(
          REISSUE_CARER_INVITATION_MUTATION,
          { input: { invitationId: item.invitationId } },
          { getBearerToken },
        );
        replaceItem(result.reissueCarerInvitation);
      } else if (action === "retry") {
        const result = await clientQuery<{
          retryCarerInvitationDelivery: CarerAccessLifecycleItem;
        }>(
          RETRY_CARER_INVITATION_DELIVERY_MUTATION,
          { input: { invitationId: item.invitationId } },
          { getBearerToken },
        );
        replaceItem(result.retryCarerInvitationDelivery);
      } else if (item.membershipId) {
        const result = await clientQuery<{
          deactivateCarerMembership: CarerAccessLifecycleItem;
        }>(
          DEACTIVATE_CARER_MEMBERSHIP_MUTATION,
          { input: { membershipId: item.membershipId } },
          { getBearerToken },
        );
        replaceItem(result.deactivateCarerMembership);
      }
      setSuccess("Carer access was updated.");
      router.refresh();
    } catch (caught) {
      setError(toSafeActionError(caught, action));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card data-testid="carer-lifecycle-panel">
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold text-slate-900">
          Carer access lifecycle
        </h2>
        <p className="text-sm text-slate-500">
          Invite a workforce login, track acceptance, then link its Carer
          profile.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={invite}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label
              htmlFor="carer-invite-email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Carer email
            </label>
            <input
              id="carer-invite-email"
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby="carer-invite-help"
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p id="carer-invite-help" className="mt-1 text-xs text-slate-500">
              Oasis sends a tenant-bound Clerk invitation with the Carer role
              fixed on the server.
            </p>
          </div>
          <Button
            type="submit"
            disabled={busy !== null || !authenticated || !isAdmin}
            className="min-h-11 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 disabled:text-white disabled:opacity-100"
          >
            {busy === "invite" ? "Inviting…" : "Invite Carer"}
          </Button>
        </form>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {success}
          </p>
        )}

        {items.length === 0 && initialError ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.refresh()}
          >
            Retry loading Carer access
          </Button>
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No Carer invitations have been created.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Carer invitations and access readiness
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Login
                  </th>
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Expires
                  </th>
                  <th scope="col" className="py-3 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.lifecycleId}
                    className="border-b border-slate-100 align-top"
                  >
                    <td className="py-4 pr-4 text-slate-700">
                      {item.emailAddress}
                    </td>
                    <td className="py-4 pr-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        {statusLabel(item)}
                      </span>
                      {deliveryMessage(item) && (
                        <p className="mt-2 text-xs text-amber-700">
                          {deliveryMessage(item)}
                        </p>
                      )}
                      {cleanupMessage(item) && (
                        <p className="mt-2 text-xs font-medium text-amber-800">
                          {cleanupMessage(item)}
                        </p>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-slate-600">
                      {item.expiresAt &&
                      (item.status === "PENDING" ||
                        item.status === "EXPIRED") ? (
                        <time dateTime={item.expiresAt}>
                          {new Date(item.expiresAt).toLocaleDateString()}
                        </time>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.canRevoke && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11 border-slate-700 text-slate-800 hover:bg-slate-100 disabled:border-slate-400 disabled:text-slate-600 disabled:opacity-100"
                            disabled={busy !== null || !authenticated || !isAdmin}
                            onClick={() => void act(item, "revoke")}
                          >
                            Revoke
                          </Button>
                        )}
                        {item.canReissue && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11 border-slate-700 text-slate-800 hover:bg-slate-100 disabled:border-slate-400 disabled:text-slate-600 disabled:opacity-100"
                            disabled={busy !== null || !authenticated || !isAdmin}
                            onClick={() => void act(item, "reissue")}
                          >
                            Send new invitation
                          </Button>
                        )}
                        {item.canRetryDelivery && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11 border-slate-700 text-slate-800 hover:bg-slate-100 disabled:border-slate-400 disabled:text-slate-600 disabled:opacity-100"
                            disabled={busy !== null || !authenticated || !isAdmin}
                            onClick={() => void act(item, "retry")}
                          >
                            Retry delivery
                          </Button>
                        )}
                        {item.canDeactivate && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11 border-slate-700 text-slate-800 hover:bg-slate-100 disabled:border-slate-400 disabled:text-slate-600 disabled:opacity-100"
                            disabled={busy !== null || !authenticated || !isAdmin}
                            onClick={() => void act(item, "deactivate")}
                          >
                            Deactivate
                          </Button>
                        )}
                        {item.canLink && (
                          <span className="self-center text-xs font-medium text-teal-700">
                            Use the profile form below to link
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
  );
}

function statusLabel(item: CarerAccessLifecycleItem) {
  if (item.readiness === "READY") return "Active · Ready for assignment";
  if (item.readiness === "LINK_REQUIRED")
    return "Active · Profile link required";
  if (item.readiness === "BLOCKED") return "Active · Profile needs review";
  if (item.status === "PENDING") return "Pending · Awaiting acceptance";
  if (item.status === "EXPIRED") return "Expired";
  return "Revoked · Access disabled";
}

function deliveryMessage(item: CarerAccessLifecycleItem) {
  if (item.status !== "PENDING") return "";
  if (item.deliveryStatus === "PENDING") return "Queued for secure delivery";
  if (item.deliveryStatus === "PROCESSING")
    return "Secure delivery in progress";
  if (item.deliveryStatus === "RETRYABLE") return "Delivery can be retried";
  if (item.deliveryStatus === "NEEDS_ATTENTION")
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

function invitationSavedMessage(item: CarerAccessLifecycleItem) {
  if (item.deliveryStatus === "DELIVERED")
    return "The secure Carer invitation is ready.";
  if (item.deliveryStatus === "RETRYABLE")
    return "The invitation was saved. Secure delivery can be retried.";
  if (item.deliveryStatus === "NEEDS_ATTENTION")
    return "The invitation was saved, but delivery needs administrator support.";
  return "The invitation was saved and secure delivery is in progress.";
}

function toSafeActionError(error: unknown, action: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("manual access review")) {
    return "This account needs manual access review before another invitation can be sent.";
  }
  if (message.includes("different access invitation")) {
    return "A different access invitation is already pending for this email.";
  }
  if (message.includes("delivery cannot be retried")) {
    return "Delivery is no longer retryable. Refresh the lifecycle before continuing.";
  }
  if (message.includes("state changed") || message.includes("no longer")) {
    return "Carer access changed while this action was running. Refresh and try again.";
  }
  return action === "invite"
    ? "The Carer invitation could not be saved safely. Retry or contact support."
    : "Carer access could not be updated safely. Refresh and retry.";
}
