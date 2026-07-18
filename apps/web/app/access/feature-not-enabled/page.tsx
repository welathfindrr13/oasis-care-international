import Link from "next/link";

export default function FeatureNotEnabledPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold text-oasis-teal-dark">Feature unavailable</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-oasis-ink">
        Medication and eMAR are not available
      </h1>
      <p className="mt-4 max-w-xl leading-7 text-oasis-muted">
        This feature is not included in the current Oasis Care launch. No
        medication information has been changed.
      </p>
      <Link
        href="/today"
        className="mt-8 inline-flex min-h-11 w-fit items-center rounded-md bg-oasis-teal px-5 py-3 font-semibold text-white hover:no-underline"
      >
        Return to Today
      </Link>
    </main>
  );
}
