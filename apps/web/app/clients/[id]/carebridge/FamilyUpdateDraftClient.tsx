"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientAccess } from "../../../../components/providers/ClientAccessProvider";
import { Alert } from "../../../../components/ui/Alert";
import { Button } from "../../../../components/ui/Button";
import { FieldError } from "../../../../components/ui/FieldError";
import { clientQuery } from "../../../../lib/graphql/client-side";
import { runSingleFlightAction } from "../../../../lib/consequential-actions";
import {
  GENERATE_VERIFIED_VISIT_STORY_MUTATION,
  type FamilyUpdateCompletedVisit,
  type GenerateVerifiedVisitStoryMutationResponse,
} from "../../../../lib/graphql/queries";
import { formatDateTime } from "../../../../lib/time";

export function FamilyUpdateDraftClient({
  careRoomId,
  completedVisits,
}: {
  careRoomId: string;
  completedVisits: FamilyUpdateCompletedVisit[];
}) {
  const access = useClientAccess();
  const router = useRouter();
  const startedRef = useRef(false);
  const visitSelectRef = useRef<HTMLSelectElement>(null);
  const [selectedVisitId, setSelectedVisitId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasVisitSelectionError = error === "Choose a completed visit.";

  async function prepareFamilyUpdate() {
    if (!selectedVisitId) {
      setError("Choose a completed visit.");
      requestAnimationFrame(() => visitSelectRef.current?.focus());
      return;
    }

    await runSingleFlightAction(startedRef, async () => {
      setBusy(true);
      setError("");
      try {
        const data =
          await clientQuery<GenerateVerifiedVisitStoryMutationResponse>(
            GENERATE_VERIFIED_VISIT_STORY_MUTATION,
            { visitId: selectedVisitId },
            { getBearerToken: access.getBearerToken },
          );
        const story = data.generateVerifiedVisitStory;
        if (
          story.status !== "DRAFT" ||
          story.familySafeVersion !== 1 ||
          !story.familySafeTitle?.trim() ||
          !story.familySafeBody?.trim()
        ) {
          throw new Error("Family-safe preview unavailable");
        }

        router.push(
          `/family-updates/approvals?careRoomId=${encodeURIComponent(careRoomId)}`,
        );
      } catch {
        setError(
          "We could not prepare this Family update. Check that the visit is still completed, then try again.",
        );
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className="mt-4 max-w-2xl">
      {error && !hasVisitSelectionError ? (
        <Alert className="mb-4" live tone="danger" title="Update not prepared">
          {error}
        </Alert>
      ) : null}

      <label
        className="block text-sm font-semibold text-oasis-ink"
        htmlFor="family-update-visit"
      >
        Completed visit
      </label>
      <select
        ref={visitSelectRef}
        id="family-update-visit"
        className="mt-2 min-h-11 w-full rounded-md border border-oasis-control-border bg-white px-3 py-2 text-base text-oasis-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-teal focus-visible:ring-offset-2"
        value={selectedVisitId}
        aria-invalid={hasVisitSelectionError}
        aria-describedby={
          hasVisitSelectionError
            ? "family-update-visit-error family-update-visit-help"
            : "family-update-visit-help"
        }
        onChange={(event) => {
          setSelectedVisitId(event.target.value);
          setError("");
        }}
        disabled={busy}
      >
        <option value="">Choose a completed visit</option>
        {completedVisits.map((visit) => (
          <option key={visit.id} value={visit.id}>
            {formatDateTime(visit.actualEnd || visit.scheduledStart)}
          </option>
        ))}
      </select>
      {hasVisitSelectionError ? (
        <FieldError id="family-update-visit-error">{error}</FieldError>
      ) : null}
      <p
        id="family-update-visit-help"
        className="mt-2 text-sm leading-6 text-oasis-muted"
      >
        This prepares a family-safe preview. Nothing is shared until a Manager
        reviews the exact preview and publishes it.
      </p>
      <Button
        className="mt-4 w-full sm:w-auto"
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => void prepareFamilyUpdate()}
      >
        {busy ? "Preparing Family update…" : "Prepare Family update"}
      </Button>
      <p className="mt-2 text-xs leading-5 text-oasis-muted">
        A connection is required to prepare the update.
      </p>
    </div>
  );
}
