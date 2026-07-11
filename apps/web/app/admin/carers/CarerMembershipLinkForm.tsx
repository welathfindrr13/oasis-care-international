"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientAccess } from "../../../components/providers/ClientAccessProvider";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { FieldError } from "../../../components/ui/FieldError";
import { StatePanel } from "../../../components/ui/StatePanel";
import { clientQuery } from "../../../lib/graphql/client-side";
import {
  CREATE_AND_LINK_CARER_MUTATION,
  type CreateAndLinkCarerMutationResponse,
  type EligibleCarerMembership,
} from "../../../lib/graphql/queries";

interface Props {
  initialMemberships: EligibleCarerMembership[];
  initialError: string | null;
}

type FormState = {
  membershipId: string;
  firstName: string;
  lastName: string;
  phone: string;
};

const EMPTY_FORM: FormState = {
  membershipId: "",
  firstName: "",
  lastName: "",
  phone: "",
};

export function CarerMembershipLinkForm({
  initialMemberships,
  initialError,
}: Props) {
  const router = useRouter();
  const { authenticated, getBearerToken, isAdmin, status } = useClientAccess();
  const [memberships, setMemberships] = useState(initialMemberships);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMemberships(initialMemberships);
    setLoadError(initialError);
  }, [initialError, initialMemberships]);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "membershipId") setMembershipError(null);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);

    if (!authenticated || !isAdmin) {
      setError(
        authenticated ? "Admin access is required." : "Sign in is required.",
      );
      return;
    }
    if (!form.membershipId) {
      setMembershipError(
        "Select an eligible workforce login before creating the Carer.",
      );
      setError(null);
      return;
    }

    setSubmitting(true);
    setMembershipError(null);
    setError(null);
    try {
      const result = await clientQuery<CreateAndLinkCarerMutationResponse>(
        CREATE_AND_LINK_CARER_MUTATION,
        {
          input: {
            membershipId: form.membershipId,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone.trim() || undefined,
          },
        },
        { getBearerToken },
      );

      const linkedMembershipId = result.createAndLinkCarer.membershipId;
      const linkedCarer = result.createAndLinkCarer.carer;
      setMemberships((current) =>
        current.filter((membership) => membership.id !== linkedMembershipId),
      );
      setForm(EMPTY_FORM);
      setSuccess(
        `${linkedCarer.firstName} ${linkedCarer.lastName} was created and linked.`,
      );
      router.refresh();
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <Card aria-labelledby="link-carer-title">
        <CardHeader>
          <h2 id="link-carer-title" className="text-xl font-semibold">
            Link a Carer profile
          </h2>
        </CardHeader>
        <CardContent>
          <StatePanel kind="loading" title="Checking administrator access">
            This form will be available after access is verified.
          </StatePanel>
        </CardContent>
      </Card>
    );
  }

  if (!authenticated || !isAdmin) {
    return (
      <Card aria-labelledby="link-carer-title">
        <CardHeader>
          <h2 id="link-carer-title" className="text-xl font-semibold">
            Link a Carer profile
          </h2>
        </CardHeader>
        <CardContent>
          <StatePanel kind="forbidden" title="Administrator access required">
            {authenticated
              ? "Your current role cannot link workforce profiles."
              : "Sign in with an administrator account to continue."}
          </StatePanel>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      id="link-carer-profile"
      className="scroll-mt-24"
      aria-labelledby="link-carer-title"
    >
      <CardHeader>
        <h2
          id="link-carer-title"
          className="text-xl font-semibold text-oasis-ink"
        >
          Link a Carer profile
        </h2>
        <p className="mt-1 text-sm leading-6 text-oasis-muted">
          Choose an accepted workforce login, then add the profile used for care
          assignments.
        </p>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <StatePanel
            kind="unavailable"
            title="Eligible logins unavailable"
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
            Eligible workforce logins could not be loaded. The Carer was not
            created or linked.
          </StatePanel>
        ) : memberships.length === 0 ? (
          <StatePanel title="No login ready to link">
            No eligible unlinked carer or staff logins are available in this
            organisation. Invite a Carer and wait for acceptance first.
          </StatePanel>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="membershipId"
                className="block text-sm font-semibold text-oasis-ink"
              >
                Workforce login{" "}
                <span className="font-normal text-oasis-muted">(required)</span>
              </label>
              <select
                id="membershipId"
                className="mt-1"
                aria-required="true"
                value={form.membershipId}
                onChange={(event) =>
                  updateField("membershipId", event.target.value)
                }
                aria-invalid={membershipError ? true : undefined}
                aria-describedby={
                  membershipError
                    ? "membershipId-help membershipId-error"
                    : "membershipId-help"
                }
              >
                <option value="">Select an unlinked workforce login</option>
                {memberships.map((membership) => (
                  <option key={membership.id} value={membership.id}>
                    {membership.loginEmail ||
                      `Workforce membership ${membership.id.slice(0, 8)}`}{" "}
                    · {membership.role} · {membership.identityProvider}
                  </option>
                ))}
              </select>
              <p
                id="membershipId-help"
                className="mt-1 text-xs leading-5 text-oasis-muted"
              >
                This explicit selection creates the login-to-Carer link. The
                verified email is copied as contact data and never used for
                authorization.
              </p>
              {membershipError && (
                <FieldError id="membershipId-error">
                  {membershipError}
                </FieldError>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="firstName"
                label="First name"
                value={form.firstName}
                onChange={(value) => updateField("firstName", value)}
                maxLength={100}
              />
              <TextField
                id="lastName"
                label="Last name"
                value={form.lastName}
                onChange={(value) => updateField("lastName", value)}
                maxLength={100}
              />
            </div>
            <TextField
              id="phone"
              label="Phone"
              type="tel"
              required={false}
              value={form.phone}
              onChange={(value) => updateField("phone", value)}
              maxLength={50}
            />

            {error && (
              <Alert tone="danger" live>
                {error}
              </Alert>
            )}
            {success && (
              <Alert tone="success" live>
                {success}
              </Alert>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              {submitting ? "Creating and linking…" : "Create and link Carer"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function TextField({
  id,
  label,
  maxLength,
  onChange,
  required = true,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  maxLength: number;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-oasis-ink"
      >
        {label}{" "}
        <span className="font-normal text-oasis-muted">
          ({required ? "required" : "optional"})
        </span>
      </label>
      <input
        id={id}
        className="mt-1"
        type={type}
        required={required}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function toUserMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("forbidden") || normalized.includes("admin"))
    return "Admin access is required. No Carer has been created.";
  if (normalized.includes("no longer eligible"))
    return "That workforce login is no longer eligible or has already been linked. Refresh and choose again.";
  if (normalized.includes("already exists") || normalized.includes("conflict"))
    return "A Carer with those profile details already exists. No login was linked.";
  if (normalized.includes("invalid") || normalized.includes("required"))
    return "Check the required profile fields and try again.";
  return "The Carer was not created or linked. Try again.";
}
