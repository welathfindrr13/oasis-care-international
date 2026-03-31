'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button, buttonVariants } from '../../components/ui/Button';
import { clientQuery } from '../../lib/graphql/client-side';
import type { Client } from '../../lib/graphql/queries';

const CREATE_CLIENT_MUTATION = `
  mutation CreateClient($input: CreateClientInput!) {
    createClient(input: $input) {
      id
      fullName
    }
  }
`;

const UPDATE_CLIENT_MUTATION = `
  mutation UpdateClient($input: UpdateClientInput!) {
    updateClient(input: $input) {
      id
      fullName
      preferredName
      pronouns
      addressLine1
      addressLine2
      city
      postcode
      dateOfBirth
      preferredLanguage
      communicationNeeds
      accessibilityAdjustments
      representativeName
      representativeRelationship
      representativePhone
      representativeEmail
    }
  }
`;

interface ClientFormProps {
  mode: 'create' | 'edit';
  client?: Client;
}

interface FormState {
  fullName: string;
  preferredName: string;
  pronouns: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  dateOfBirth: string;
  preferredLanguage: string;
  communicationNeeds: string;
  accessibilityAdjustments: string;
  representativeName: string;
  representativeRelationship: string;
  representativePhone: string;
  representativeEmail: string;
}

function toDateInputValue(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

export default function ClientForm({ mode, client }: ClientFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyNoticeAcknowledged, setPrivacyNoticeAcknowledged] = useState(false);
  const [form, setForm] = useState<FormState>({
    fullName: client?.fullName ?? '',
    preferredName: client?.preferredName ?? '',
    pronouns: client?.pronouns ?? '',
    addressLine1: client?.addressLine1 ?? '',
    addressLine2: client?.addressLine2 ?? '',
    city: client?.city ?? '',
    postcode: client?.postcode ?? '',
    dateOfBirth: toDateInputValue(client?.dateOfBirth),
    preferredLanguage: client?.preferredLanguage ?? '',
    communicationNeeds: client?.communicationNeeds ?? '',
    accessibilityAdjustments: client?.accessibilityAdjustments ?? '',
    representativeName: client?.representativeName ?? '',
    representativeRelationship: client?.representativeRelationship ?? '',
    representativePhone: client?.representativePhone ?? '',
    representativeEmail: client?.representativeEmail ?? '',
  });

  const validationError = useMemo(() => {
    if (!form.fullName.trim()) return 'Full name is required.';
    if (!form.addressLine1.trim()) return 'Address line 1 is required.';
    if (!form.city.trim()) return 'City is required.';
    if (!form.postcode.trim()) return 'Postcode is required.';
    if (mode === 'create' && !privacyNoticeAcknowledged) {
      return 'Confirm the privacy notice acknowledgement before creating the client.';
    }
    return null;
  }, [form, mode, privacyNoticeAcknowledged]);

  const canSubmit = !isSubmitting && !validationError;

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setError(null);
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const input = {
      fullName: form.fullName.trim(),
      preferredName: form.preferredName.trim() || null,
      pronouns: form.pronouns.trim() || null,
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim() || null,
      city: form.city.trim(),
      postcode: form.postcode.trim().toUpperCase(),
      dateOfBirth: form.dateOfBirth || null,
      preferredLanguage: form.preferredLanguage.trim() || null,
      communicationNeeds: form.communicationNeeds.trim() || null,
      accessibilityAdjustments: form.accessibilityAdjustments.trim() || null,
      representativeName: form.representativeName.trim() || null,
      representativeRelationship: form.representativeRelationship.trim() || null,
      representativePhone: form.representativePhone.trim() || null,
      representativeEmail: form.representativeEmail.trim() || null,
    };

    try {
      if (mode === 'create') {
        const response = await clientQuery<{ createClient: { id: string } }>(CREATE_CLIENT_MUTATION, {
          input: {
            ...input,
            privacyNoticeAcknowledged: true,
            privacyNoticeVersion: 'pilot-v1',
          },
        });

        router.push(`/clients/${response.createClient.id}`);
      } else {
        await clientQuery(UPDATE_CLIENT_MUTATION, {
          input: {
            id: client?.id,
            ...input,
          },
        });

        router.push(`/clients/${client?.id}`);
      }

      router.refresh();
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to save the client right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === 'create' ? 'Client information' : 'Client profile';
  const description =
    mode === 'create'
      ? 'Register a real client record with the operational profile needed for care delivery.'
      : 'Update the operational profile that supports care planning and visit delivery.';
  const cancelHref = mode === 'create' ? '/clients' : `/clients/${client?.id}`;
  const submitLabel = mode === 'create' ? 'Create Client' : 'Save Changes';

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-slate-900 font-heading">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-slate-700">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="preferredName" className="mb-2 block text-sm font-medium text-slate-700">
                Preferred name
              </label>
              <input
                id="preferredName"
                name="preferredName"
                value={form.preferredName}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="pronouns" className="mb-2 block text-sm font-medium text-slate-700">
                Pronouns
              </label>
              <input
                id="pronouns"
                name="pronouns"
                value={form.pronouns}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="addressLine1" className="mb-2 block text-sm font-medium text-slate-700">
                Address line 1 <span className="text-red-500">*</span>
              </label>
              <input
                id="addressLine1"
                name="addressLine1"
                value={form.addressLine1}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="addressLine2" className="mb-2 block text-sm font-medium text-slate-700">
                Address line 2
              </label>
              <input
                id="addressLine2"
                name="addressLine2"
                value={form.addressLine2}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="city" className="mb-2 block text-sm font-medium text-slate-700">
                City <span className="text-red-500">*</span>
              </label>
              <input
                id="city"
                name="city"
                value={form.city}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="postcode" className="mb-2 block text-sm font-medium text-slate-700">
                Postcode <span className="text-red-500">*</span>
              </label>
              <input
                id="postcode"
                name="postcode"
                value={form.postcode}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="mb-2 block text-sm font-medium text-slate-700">
                Date of birth
              </label>
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="preferredLanguage" className="mb-2 block text-sm font-medium text-slate-700">
                Preferred language
              </label>
              <input
                id="preferredLanguage"
                name="preferredLanguage"
                value={form.preferredLanguage}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="communicationNeeds" className="mb-2 block text-sm font-medium text-slate-700">
                Communication needs
              </label>
              <textarea
                id="communicationNeeds"
                name="communicationNeeds"
                rows={3}
                value={form.communicationNeeds}
                onChange={handleChange}
                placeholder="Preferred communication approach, interpreter needs, or information format."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="accessibilityAdjustments" className="mb-2 block text-sm font-medium text-slate-700">
                Accessibility adjustments
              </label>
              <textarea
                id="accessibilityAdjustments"
                name="accessibilityAdjustments"
                rows={3}
                value={form.accessibilityAdjustments}
                onChange={handleChange}
                placeholder="Reasonable adjustments carers and coordinators should keep visible."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="representativeName" className="mb-2 block text-sm font-medium text-slate-700">
                Representative name
              </label>
              <input
                id="representativeName"
                name="representativeName"
                value={form.representativeName}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="representativeRelationship" className="mb-2 block text-sm font-medium text-slate-700">
                Representative relationship
              </label>
              <input
                id="representativeRelationship"
                name="representativeRelationship"
                value={form.representativeRelationship}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="representativePhone" className="mb-2 block text-sm font-medium text-slate-700">
                Representative phone
              </label>
              <input
                id="representativePhone"
                name="representativePhone"
                value={form.representativePhone}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="representativeEmail" className="mb-2 block text-sm font-medium text-slate-700">
                Representative email
              </label>
              <input
                id="representativeEmail"
                name="representativeEmail"
                type="email"
                value={form.representativeEmail}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {mode === 'create' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-blue-800">Privacy notice and lawful basis check</h3>
              <p className="mt-2 text-sm text-blue-700">
                Before creating a record, confirm that the privacy notice has been provided, or arranged to be
                provided, under the organisation&apos;s lawful basis for care delivery.
              </p>
              <p className="mt-2 text-xs text-blue-700">
                Read the <Link href="/privacy" className="underline underline-offset-2">privacy notice</Link> and{' '}
                <Link href="/data-processing" className="underline underline-offset-2">data processing summary</Link>.
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm text-blue-800">
                <input
                  type="checkbox"
                  checked={privacyNoticeAcknowledged}
                  onChange={(event) => setPrivacyNoticeAcknowledged(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>
                  I confirm that the privacy information has been provided, or arranged to be provided, and that I
                  am creating this record under the organisation&apos;s lawful basis for care delivery.
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {validationError && !error && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">{validationError}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <Link href={cancelHref} className={buttonVariants({ variant: 'ghost' })}>
              Cancel
            </Link>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
