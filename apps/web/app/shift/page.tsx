'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useClientAccess } from '../../components/providers/ClientAccessProvider';
import { Header } from '../../components/oasis/Header';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { StatePanel } from '../../components/ui/StatePanel';
import { clientQuery } from '../../lib/graphql/client-side';
import { runSingleFlightAction } from '../../lib/consequential-actions';
import { formatDateTime as formatOrganizationDateTime } from '../../lib/time';
import {
  CLOCK_IN_MUTATION,
  CLOCK_OUT_MUTATION,
  MY_ACTIVE_SHIFT_QUERY,
  MY_RECENT_SHIFTS_QUERY,
  type CarerShift,
  type ClockInMutationResponse,
  type ClockOutMutationResponse,
  type MyActiveShiftQueryResponse,
  type MyRecentShiftsQueryResponse,
  type ShiftVerificationMethod,
} from '../../lib/graphql/queries';
import { shiftVerificationLabel } from './shiftPresentation';

type LocationPayload = {
  method: ShiftVerificationMethod;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  reasonCode?: string;
};

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return formatOrganizationDateTime(value);
}

function formatDuration(clockInAt: string, clockOutAt?: string | null): string {
  const start = new Date(clockInAt).getTime();
  const end = clockOutAt ? new Date(clockOutAt).getTime() : Date.now();
  const diffMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default function ShiftPage() {
  const { isCarer, isAdmin } = useClientAccess();

  const [activeShift, setActiveShift] = useState<CarerShift | null>(null);
  const [recentShifts, setRecentShifts] = useState<CarerShift[]>([]);
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [recentShiftsUnavailable, setRecentShiftsUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const shiftActionStartedRef = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [activeResult, recentResult] = await Promise.allSettled([
        clientQuery<MyActiveShiftQueryResponse>(MY_ACTIVE_SHIFT_QUERY),
        clientQuery<MyRecentShiftsQueryResponse>(MY_RECENT_SHIFTS_QUERY, { take: 5 }),
      ]);

      if (activeResult.status === 'fulfilled') {
        setActiveShift(activeResult.value.myActiveShift || null);
        setStatusUnavailable(false);
      } else {
        setStatusUnavailable(true);
        setError(
          'We could not load your shift status. Check your connection and try again.',
        );
      }

      if (recentResult.status === 'fulfilled') {
        setRecentShifts(recentResult.value.myRecentShifts || []);
        setRecentShiftsUnavailable(false);
      } else {
        setRecentShifts([]);
        setRecentShiftsUnavailable(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getLocationPayload = useCallback(async (): Promise<LocationPayload> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return { method: 'MANUAL', reasonCode: 'NO_GEO_API' };
    }

    const location = await new Promise<LocationPayload>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            method: 'GPS',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          });
        },
        (geoError) => {
          const codeMap: Record<number, string> = {
            1: 'PERMISSION_DENIED',
            2: 'POSITION_UNAVAILABLE',
            3: 'TIMEOUT',
          };
          resolve({
            method: 'MANUAL',
            reasonCode: codeMap[geoError.code] || 'GEO_CAPTURE_FAILED',
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        },
      );
    });

    return location;
  }, []);

  const handleClockIn = useCallback(async () => {
    if (!consentChecked) {
      setError(
        'Confirm that you understand how location is used before you clock in.',
      );
      return;
    }

    await runSingleFlightAction(shiftActionStartedRef, async () => {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      try {
        const payload = await getLocationPayload();
        const result = await clientQuery<ClockInMutationResponse>(CLOCK_IN_MUTATION, {
          input: {
            ...payload,
            source: 'web',
            notes: payload.method === 'MANUAL' ? 'Manual verification fallback used' : undefined,
          },
        });
        setActiveShift(result.clockIn);
        setSuccess(`Clocked in at ${formatDateTime(result.clockIn.clockInAt)}.`);
        await loadData();
      } catch {
        setError(
          'We could not clock you in. Check your connection and try again.',
        );
      } finally {
        setSubmitting(false);
      }
    });
  }, [consentChecked, getLocationPayload, loadData]);

  const handleClockOut = useCallback(async () => {
    if (!activeShift?.id) {
      setError('No active shift is available to clock out.');
      return;
    }

    await runSingleFlightAction(shiftActionStartedRef, async () => {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      try {
        const payload = await getLocationPayload();
        const result = await clientQuery<ClockOutMutationResponse>(CLOCK_OUT_MUTATION, {
          input: {
            shiftId: activeShift.id,
            ...payload,
            source: 'web',
            notes: payload.method === 'MANUAL' ? 'Manual verification fallback used' : undefined,
          },
        });
        setActiveShift(result.clockOut);
        setSuccess(`Clocked out at ${formatDateTime(result.clockOut.clockOutAt)}.`);
        await loadData();
      } catch {
        setError(
          'We could not clock you out. Check your connection and try again.',
        );
      } finally {
        setSubmitting(false);
      }
    });
  }, [activeShift, getLocationPayload, loadData]);

  return (
    <div className="min-h-screen bg-oasis-canvas">
      <Header />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-oasis-ink">
            My shift
          </h1>
          <p className="mt-2 max-w-2xl leading-7 text-oasis-muted">
            Clock in when you start work and clock out when you finish.
          </p>
        </div>

        {error && (
          <Alert
            tone="danger"
            title={
              statusUnavailable
                ? 'Shift status unavailable'
                : 'Shift action not completed'
            }
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert tone="success" live title="Shift status updated">
            {success}
          </Alert>
        )}

        <Card>
          <CardHeader>
            <h2 className="font-heading text-xl font-semibold text-oasis-ink">
              Current status
            </h2>
            <p className="mt-2 text-sm leading-6 text-oasis-muted">
              Oasis asks for your location only when you clock in or out. If it
              is unavailable or you decline, Oasis records a manual check. Your
              location is not tracked continuously.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-oasis-muted" role="status" aria-live="polite">
                Loading shift status…
              </p>
            ) : statusUnavailable ? (
              <StatePanel
                action={
                  <Button
                    onClick={() => {
                      setSuccess(null);
                      void loadData();
                    }}
                  >
                    Try again
                  </Button>
                }
                kind="unavailable"
                title="Shift status unavailable"
              >
                <p>
                  No shift action is available until your current status can be
                  checked.
                </p>
              </StatePanel>
            ) : isAdmin ? (
              <div className="space-y-3">
                <p className="text-oasis-muted">
                  Shift actions are available to Carers.
                </p>
                <Button asChild variant="secondary">
                  <Link href="/admin/analytics">Open shift analytics</Link>
                </Button>
              </div>
            ) : isCarer ? (
              <div className="space-y-5">
                <div className="border-l-4 border-oasis-teal bg-base-gray-50 px-4 py-3">
                  <div className="text-sm font-medium text-oasis-muted">
                    Status
                  </div>
                  <div className="mt-1 text-xl font-semibold text-oasis-ink">
                    {activeShift?.isActive ? 'Clocked in' : 'Not clocked in'}
                  </div>
                  {activeShift?.isActive && (
                    <div className="mt-1 text-sm leading-6 text-oasis-muted">
                      Since {formatDateTime(activeShift.clockInAt)} (
                      {formatDuration(activeShift.clockInAt)})
                    </div>
                  )}
                </div>

                {!activeShift?.isActive && (
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm leading-6 text-oasis-ink">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-oasis-teal"
                    />
                    <span>
                      I understand how location is used when I clock in or out.
                    </span>
                  </label>
                )}

                <div>
                  {activeShift?.isActive ? (
                    <Button
                      className="w-full sm:w-auto"
                      size="lg"
                      onClick={handleClockOut}
                      disabled={submitting}
                    >
                      {submitting ? 'Clocking out…' : 'Clock out'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full sm:w-auto"
                      size="lg"
                      onClick={handleClockIn}
                      disabled={submitting || !consentChecked}
                    >
                      {submitting ? 'Clocking in…' : 'Clock in'}
                    </Button>
                  )}
                  <p className="mt-3 text-sm leading-6 text-oasis-muted">
                    Clocking in and out needs an internet connection.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-oasis-muted">
                This page is available to Carers and Managers only.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-semibold text-oasis-ink">
                  Recent shifts
                </h2>
                <p className="mt-1 text-sm text-oasis-muted">
                  Your five most recent shift records.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setSuccess(null);
                  void loadData();
                }}
                disabled={loading || submitting}
                aria-label="Refresh shift status and recent shifts"
              >
                Refresh status
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-oasis-muted" role="status">
                Loading recent shifts…
              </p>
            ) : recentShiftsUnavailable ? (
              <StatePanel
                action={
                  <Button
                    onClick={() => {
                      setSuccess(null);
                      void loadData();
                    }}
                  >
                    Try again
                  </Button>
                }
                kind="unavailable"
                title="Recent shifts are unavailable"
              >
                <p>
                  Your current shift action is still available. Check your
                  connection and try loading the history again.
                </p>
              </StatePanel>
            ) : recentShifts.length === 0 ? (
              <p className="text-oasis-muted">
                No recent shifts yet. Your completed shifts will appear here.
              </p>
            ) : (
              <div className="divide-y divide-oasis-border">
                {recentShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-oasis-ink">
                        {formatDateTime(shift.clockInAt)}
                        {shift.clockOutAt
                          ? ` → ${formatDateTime(shift.clockOutAt)}`
                          : ' → Active'}
                      </div>
                      <div className="mt-1 text-sm text-oasis-muted">
                        In: {shiftVerificationLabel(shift.clockInProof.method)}
                        {shift.clockOutProof?.method
                          ? ` · Out: ${shiftVerificationLabel(shift.clockOutProof.method)}`
                          : ''}
                      </div>
                    </div>
                    <div className="text-sm tabular-nums text-oasis-muted">
                      {formatDuration(shift.clockInAt, shift.clockOutAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
