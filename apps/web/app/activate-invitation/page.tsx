import { ActivationClient } from "./ActivationClient";
import { resolveAuthMode } from "../../lib/auth/mode";

export const dynamic = "force-dynamic";

export default function ActivateInvitationPage() {
  if (resolveAuthMode(process.env) !== "clerk") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-700">
          Secure invitation activation is not available in this environment. No
          care information has been loaded.
        </p>
      </main>
    );
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white">
          O
        </div>
        <h1 className="mt-6 font-heading text-3xl font-black text-slate-950">
          Finish secure invitation activation
        </h1>
        <p className="mb-7 mt-3 text-sm leading-6 text-slate-600">
          Oasis will verify the accepted Clerk invitation before creating any
          internal access. Your administrator may still need to finish linking
          your profile. No care information is loaded during this step.
        </p>
        <ActivationClient />
      </section>
    </main>
  );
}
