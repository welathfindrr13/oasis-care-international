import Link from "next/link";
import { ChooseOrganizationTaskActions } from "./ChooseOrganizationTaskActions";

export const metadata = {
  title: "Company access is not ready | Oasis Care",
  description: "Continue through the governed Oasis company access process.",
};

export default function ChooseOrganizationTaskPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-oasis-canvas px-4 py-10 sm:px-6">
      <section
        className="w-full max-w-xl rounded-lg border border-oasis-border bg-white p-6 shadow-sm sm:p-8"
        aria-labelledby="company-access-heading"
      >
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-md bg-oasis-teal text-lg font-bold text-white"
        >
          O
        </div>

        <p className="mt-6 text-sm font-semibold text-oasis-teal-dark">
          Oasis Care
        </p>
        <h1
          id="company-access-heading"
          className="mt-2 font-heading text-3xl font-bold tracking-tight text-oasis-ink sm:text-4xl"
        >
          Company access is not ready
        </h1>
        <p className="mt-4 text-base leading-7 text-oasis-muted">
          An Oasis company is created only after the platform team approves a
          company request. Signing in alone does not create a company or give
          access to care information.
        </p>

        <Link
          href="/request-access"
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-oasis-teal bg-oasis-teal px-5 py-3 text-base font-semibold text-white hover:border-oasis-teal-dark hover:bg-oasis-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-teal focus-visible:ring-offset-2"
        >
          Request company access
        </Link>

        <div className="mt-7 border-t border-oasis-border pt-6">
          <h2 className="text-base font-bold text-oasis-ink">
            Already approved?
          </h2>
          <p className="mt-2 text-sm leading-6 text-oasis-muted">
            Use the secure link in your invitation email. It connects the
            approved company to your Oasis access.
          </p>
        </div>

        <div className="mt-6">
          <ChooseOrganizationTaskActions />
        </div>

        <p className="mt-6 text-sm text-oasis-muted">
          No care information has been loaded.
        </p>
      </section>
    </main>
  );
}
