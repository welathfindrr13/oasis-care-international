import { Header } from '../../../components/oasis/Header';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { query } from '../../../lib/graphql/client';
import {
  SHIFT_ANALYTICS_QUERY,
  type ShiftAnalyticsQueryResponse,
} from '../../../lib/graphql/queries';

export const dynamic = 'force-dynamic';

async function getShiftAnalytics() {
  try {
    const response = await query<ShiftAnalyticsQueryResponse>(SHIFT_ANALYTICS_QUERY);
    return response.shiftAnalytics;
  } catch {
    return {
      activeCarersNow: 0,
      openShiftCount: 0,
      clockIns: 0,
      clockOuts: 0,
      averageShiftMinutes: 0,
      clockInMethods: { gps: 0, qr: 0, nfc: 0, phone: 0, manual: 0 },
      clockOutMethods: { gps: 0, qr: 0, nfc: 0, phone: 0, manual: 0 },
    };
  }
}

export default async function AdminAnalyticsPage() {
  const analytics = await getShiftAnalytics();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            Workforce Analytics
          </h1>
          <p className="text-slate-500 mt-1">
            Shift compliance, verification quality, and active coverage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard label="Active Carers" value={analytics.activeCarersNow} />
          <MetricCard label="Open Shifts" value={analytics.openShiftCount} />
          <MetricCard label="Clock-ins Today" value={analytics.clockIns} />
          <MetricCard label="Clock-outs Today" value={analytics.clockOuts} />
          <MetricCard label="Avg Shift (min)" value={analytics.averageShiftMinutes} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MethodCard title="Clock-in Methods" methods={analytics.clockInMethods} />
          <MethodCard title="Clock-out Methods" methods={analytics.clockOutMethods} />
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-slate-500">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function MethodCard({
  title,
  methods,
}: {
  title: string;
  methods: { gps: number; qr: number; nfc: number; phone: number; manual: number };
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-slate-900 font-heading">{title}</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <Row label="GPS" value={methods.gps} />
          <Row label="QR" value={methods.qr} />
          <Row label="NFC" value={methods.nfc} />
          <Row label="Phone" value={methods.phone} />
          <Row label="Manual Override" value={methods.manual} />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}
