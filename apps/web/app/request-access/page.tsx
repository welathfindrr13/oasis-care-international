import Link from "next/link";
import { RequestAccessForm } from "./RequestAccessForm";

export const metadata = {
  title: "Request access | Oasis Care",
  description: "Request an Oasis Care organization review.",
};

export default function RequestAccessPage() {
  return (
    <main className="min-h-screen bg-[#f6f2ea] px-6 py-10 text-slate-950 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 text-slate-950 hover:no-underline"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white">
              O
            </span>
            <span className="font-heading text-lg font-black">Oasis Care</span>
          </Link>
          <Link href="/login" className="text-sm font-bold text-teal-800">
            Already have access? Sign in
          </Link>
        </header>

        <div className="grid gap-10 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <section className="pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-800">
              Company onboarding
            </p>
            <h1 className="font-heading text-5xl font-black leading-none tracking-[-0.04em]">
              Request a review for your care company
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-700">
              Tell us who you are and how to reach you. Our platform team
              reviews every request before an organization or administrator
              invitation is created.
            </p>
            <ul className="mt-8 space-y-3 text-sm leading-6 text-slate-700">
              <li>
                • No client, medical, clinical, or care-record information is
                needed.
              </li>
              <li>
                • A submission is a review request, not an active account.
              </li>
              <li>
                • Approved companies receive a time-limited administrator
                invitation.
              </li>
            </ul>
          </section>

          <section className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-2xl shadow-slate-900/10 sm:p-9">
            <RequestAccessForm />
          </section>
        </div>
      </div>
    </main>
  );
}
