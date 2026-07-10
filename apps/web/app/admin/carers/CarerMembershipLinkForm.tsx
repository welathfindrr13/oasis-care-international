"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientAccess } from "../../../components/providers/ClientAccessProvider";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMemberships(initialMemberships);
    setLoadError(initialError);
  }, [initialError, initialMemberships]);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
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
      setError("Select an eligible workforce login before creating the Carer.");
      return;
    }

    setSubmitting(true);
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
      <Card>
        <CardContent>
          <p className="text-sm text-slate-600" role="status">
            Checking administrator access…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!authenticated || !isAdmin) {
    return (
      <Card>
        <CardContent>
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {authenticated
              ? "Admin access is required."
              : "Sign in is required."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-slate-900 font-heading">
          Create and link a Carer
        </h2>
        <p className="text-sm text-slate-500">
          Select an existing workforce login, then create the domain Carer
          profile it will use.
        </p>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <div className="space-y-3">
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              role="alert"
            >
              Eligible workforce logins could not be loaded. No Carer has been
              created.
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.refresh()}
            >
              Retry
            </Button>
          </div>
        ) : memberships.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No eligible unlinked carer or staff logins are available in this
            organization.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="membershipId"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Workforce login <span className="text-red-500">*</span>
              </label>
              <select
                id="membershipId"
                required
                value={form.membershipId}
                onChange={(event) =>
                  updateField("membershipId", event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              <p className="mt-1 text-xs text-slate-500">
                This explicit selection creates the login-to-Carer link. Its
                verified login email is copied as contact data and is never used
                for authorization.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              label="Phone (optional)"
              type="tel"
              required={false}
              value={form.phone}
              onChange={(value) => updateField("phone", value)}
              maxLength={50}
            />

            {error && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                role="status"
                aria-live="polite"
              >
                {success}
              </div>
            )}

            <Button type="submit" disabled={submitting}>
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
        className="block text-sm font-medium text-slate-700 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  );
}

function toUserMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("forbidden") || normalized.includes("admin")) {
    return "Admin access is required. No Carer has been created.";
  }
  if (normalized.includes("no longer eligible")) {
    return "That workforce login is no longer eligible or has already been linked. Refresh and choose again.";
  }
  if (
    normalized.includes("already exists") ||
    normalized.includes("conflict")
  ) {
    return "A Carer with those profile details already exists. No login was linked.";
  }
  if (normalized.includes("invalid") || normalized.includes("required")) {
    return "Check the required profile fields and try again.";
  }
  return "The Carer was not created or linked. Try again.";
}
