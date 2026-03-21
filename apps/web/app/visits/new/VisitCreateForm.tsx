'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Button, buttonVariants } from '../../../components/ui/Button';
import { clientQuery } from '../../../lib/graphql/client-side';
import type { Carer, ClientListItem } from '../../../lib/graphql/queries';

const CREATE_VISIT_MUTATION = `
  mutation CreateVisit($input: CreateVisitInput!) {
    createVisit(input: $input) {
      id
      scheduledStart
      scheduledEnd
      status
    }
  }
`;

interface VisitCreateFormProps {
  clients: ClientListItem[];
  carers: Carer[];
  loadErrors: string[];
  initialPrefill: {
    clientId?: string;
    carerId?: string;
    startTime?: string;
    endTime?: string;
    notes?: string;
  };
}

interface VisitFormState {
  clientId: string;
  carerId: string;
  startTime: string;
  endTime: string;
  notes: string;
}

function formatDateTimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getNextHalfHourValue(): string {
  const now = new Date();
  now.setSeconds(0, 0);

  const rounded = new Date(now);
  if (rounded.getMinutes() === 0 || rounded.getMinutes() === 30) {
    rounded.setMinutes(rounded.getMinutes() + 30);
  } else if (rounded.getMinutes() < 30) {
    rounded.setMinutes(30);
  } else {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  }

  return formatDateTimeLocalValue(rounded);
}

function addMinutes(localDateTimeValue: string, minutesToAdd: number): string {
  const date = new Date(localDateTimeValue);
  date.setMinutes(date.getMinutes() + minutesToAdd);
  return formatDateTimeLocalValue(date);
}

function normalizePrefillDateTime(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return formatDateTimeLocalValue(parsed);
}

export default function VisitCreateForm({
  clients,
  carers,
  loadErrors,
  initialPrefill,
}: VisitCreateFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialState = useMemo(() => {
    const warnings: string[] = [];
    const defaultStart = getNextHalfHourValue();
    const startTime = normalizePrefillDateTime(initialPrefill.startTime, defaultStart);
    const endTime = normalizePrefillDateTime(initialPrefill.endTime, addMinutes(startTime, 60));

    let clientId = initialPrefill.clientId ?? '';
    let carerId = initialPrefill.carerId ?? '';

    if (clientId && !clients.some((client) => client.id === clientId)) {
      warnings.push('The preselected client is no longer available. Please choose a valid client.');
      clientId = '';
    }

    if (carerId && !carers.some((carer) => carer.id === carerId)) {
      warnings.push('The preselected carer is no longer available. Please choose a valid carer.');
      carerId = '';
    }

    return {
      form: {
        clientId,
        carerId,
        startTime,
        endTime,
        notes: initialPrefill.notes ?? '',
      },
      warnings,
    };
  }, [carers, clients, initialPrefill]);

  const [form, setForm] = useState<VisitFormState>(initialState.form);

  const validationError = useMemo(() => {
    if (!form.clientId) {
      return 'Select a client to continue.';
    }

    if (!form.carerId) {
      return 'Select a carer to continue.';
    }

    if (!form.startTime || !form.endTime) {
      return 'Provide both a start time and an end time.';
    }

    if (new Date(form.endTime) <= new Date(form.startTime)) {
      return 'End time must be after start time.';
    }

    return null;
  }, [form]);

  const canSubmit = !isSubmitting && !validationError && clients.length > 0 && carers.length > 0;

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setError(null);
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await clientQuery(CREATE_VISIT_MUTATION, {
        input: {
          clientId: form.clientId,
          carerId: form.carerId,
          scheduledStart: new Date(form.startTime).toISOString(),
          scheduledEnd: new Date(form.endTime).toISOString(),
          notes: form.notes.trim() || null,
        },
      });

      router.push('/visits');
      router.refresh();
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to schedule the visit right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-slate-900 font-heading">
          Visit Details
        </h2>
        <p className="text-sm text-slate-500">
          Schedule a real visit using live client and carer records.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-slate-700 mb-2">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              id="clientId"
              name="clientId"
              value={form.clientId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">Select a client...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.fullName} - {client.addressLine1}, {client.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="carerId" className="block text-sm font-medium text-slate-700 mb-2">
              Carer <span className="text-red-500">*</span>
            </label>
            <select
              id="carerId"
              name="carerId"
              value={form.carerId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">Select a carer...</option>
              {carers.map((carer) => (
                <option key={carer.id} value={carer.id}>
                  {carer.firstName} {carer.lastName} - {carer.email}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-slate-700 mb-2">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                id="startTime"
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-slate-700 mb-2">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                id="endTime"
                name="endTime"
                value={form.endTime}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2">
              Visit Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              value={form.notes}
              onChange={handleChange}
              placeholder="Add any special instructions or notes for this visit..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {loadErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" role="alert">
              <p className="text-sm font-medium text-amber-900">Some scheduling data could not be loaded.</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {loadErrors.map((loadErrorMessage) => (
                  <li key={loadErrorMessage}>{loadErrorMessage}</li>
                ))}
              </ul>
            </div>
          )}

          {initialState.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" role="alert">
              <ul className="space-y-1 text-sm text-amber-800">
                {initialState.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <Link href="/visits" className={buttonVariants({ variant: 'ghost' })}>
              Cancel
            </Link>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Scheduling...' : 'Schedule Visit'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
