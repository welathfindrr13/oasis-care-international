'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useClientAccess } from '../../components/providers/ClientAccessProvider';
import { Header } from '../../components/oasis/Header';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { clientQuery } from '../../lib/graphql/client-side';
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [activeRes, recentRes] = await Promise.all([
        clientQuery<MyActiveShiftQueryResponse>(MY_ACTIVE_SHIFT_QUERY),
        clientQuery<MyRecentShiftsQueryResponse>(MY_RECENT_SHIFTS_QUERY, { take: 5 }),
      ]);

      setActiveShift(activeRes.myActiveShift || null);
      setRecentShifts(recentRes.myRecentShifts || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load shift status');
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
      setError('Please confirm consent for location processing before clock in.');
      return;
    }

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
      setSuccess(`Clocked in at ${formatDateTime(result.clockIn.clockInAt)}`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Clock in failed');
    } finally {
      setSubmitting(false);
    }
  }, [consentChecked, getLocationPayload, loadData]);

  const handleClockOut = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = await getLocationPayload();
      const result = await clientQuery<ClockOutMutationResponse>(CLOCK_OUT_MUTATION, {
        input: {
          ...payload,
          source: 'web',
          notes: payload.method === 'MANUAL' ? 'Manual verification fallback used' : undefined,
        },
      });
      setActiveShift(result.clockOut);
      setSuccess(`Clocked out at ${formatDateTime(result.clockOut.clockOutAt)}`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Clock out failed');
    } finally {
      setSubmitting(false);
    }
  }, [getLocationPayload, loadData]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Shift Clock</h1>
          <p className="text-slate-500 mt-1">
            Clock in and out with proof-of-presence for payroll and compliance.
          </p>
        </div>

        {(error || success) && (
          <div
            className={`rounded-lg border p-4 text-sm ${
              error
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || success}
          </div>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-slate-900 font-heading">Current status</h2>
            <p className="text-sm text-slate-500">
              Location is collected only at clock-in/out events, not continuously.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-600">Loading shift status...</p>
            ) : isAdmin ? (
              <div className="space-y-3">
                <p className="text-slate-700">
                  Admin accounts do not perform shift clock actions.
                </p>
                <Button asChild variant="primary" size="sm">
                  <Link href="/admin/analytics">View Shift Analytics</Link>
                </Button>
              </div>
            ) : isCarer ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-slate-100 px-4 py-3">
                  <div className="text-sm text-slate-500">Status</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {activeShift?.isActive ? 'Clocked In' : 'Clocked Out'}
                  </div>
                  {activeShift?.isActive && (
                    <div className="text-sm text-slate-600 mt-1">
                      Since {formatDateTime(activeShift.clockInAt)} ({formatDuration(activeShift.clockInAt)})
                    </div>
                  )}
                </div>

                {!activeShift?.isActive && (
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      I confirm I understand location proof is processed for workforce management,
                      payroll verification, safeguarding, and compliance obligations.
                    </span>
                  </label>
                )}

                <div className="flex items-center gap-3">
                  {activeShift?.isActive ? (
                    <Button variant="primary" onClick={handleClockOut} disabled={submitting}>
                      {submitting ? 'Clocking out...' : 'Clock Out'}
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={handleClockIn} disabled={submitting || !consentChecked}>
                      {submitting ? 'Clocking in...' : 'Clock In'}
                    </Button>
                  )}

                  <Button variant="ghost" onClick={() => loadData()} disabled={loading || submitting}>
                    Refresh
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-slate-700">This page is available to carers and admins only.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-slate-900 font-heading">Recent shift events</h2>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-600">Loading recent shifts...</p>
            ) : recentShifts.length === 0 ? (
              <p className="text-slate-600">No recent shifts found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentShifts.map((shift) => (
                  <div key={shift.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-900">
                        {formatDateTime(shift.clockInAt)}
                        {shift.clockOutAt ? ` → ${formatDateTime(shift.clockOutAt)}` : ' → Active'}
                      </div>
                      <div className="text-sm text-slate-500">
                        In: {shift.clockInProof.method}
                        {shift.clockOutProof?.method ? ` | Out: ${shift.clockOutProof.method}` : ''}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 tabular-nums">
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
