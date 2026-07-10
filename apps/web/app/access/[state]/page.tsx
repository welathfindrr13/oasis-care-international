import { notFound } from "next/navigation";
import { AccessStateActions } from "../AccessStateActions";

const messages = {
  "no-membership": {
    title: "Access is not set up",
    body: "Your sign-in is valid, but it is not connected to an Oasis organization yet.",
  },
  disabled: {
    title: "Access is disabled",
    body: "This account cannot currently open an Oasis workspace. Contact your organization administrator.",
  },
  pending: {
    title: "Invitation pending",
    body: "Your invitation is waiting to be completed before organization information can be shown.",
  },
  setup: {
    title: "Setup required",
    body: "Your sign-in is accepted. An organization administrator must finish linking the account profile before care information can be opened.",
  },
  unavailable: {
    title: "Access is temporarily unavailable",
    body: "Oasis could not safely resolve this account. Try again or contact your organization administrator.",
  },
} as const;

export default function AccessStatePage({
  params,
}: {
  params: { state: string };
}) {
  const message = messages[params.state as keyof typeof messages];
  if (!message) notFound();

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white">
          O
        </div>
        <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight text-slate-950">
          {message.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message.body}</p>
        <div className="mt-7">
          <AccessStateActions />
        </div>
        <p className="mt-5 text-xs text-slate-400">
          No care information has been loaded.
        </p>
      </section>
    </main>
  );
}
