import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-slate-900 mb-2">You are offline</h1>
        <p className="text-slate-600 mb-6">
          Oasis Care needs an internet connection for live care data and secure clinical workflows.
        </p>
        <p className="text-sm text-slate-500 mb-6">
          Reconnect to continue using visits, care logs, eMAR, and summary features.
        </p>
        <Link
          href="/today"
          className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors"
        >
          Retry
        </Link>
      </div>
    </div>
  );
}
