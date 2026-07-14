import { notFound } from "next/navigation";
import { AccessStateActions } from "../AccessStateActions";

const messages = {
  "no-membership": {
    title: "Access is not set up",
    body: "Your sign-in worked, but it is not connected to an Oasis organisation yet. Ask your Manager to finish setting up access.",
  },
  disabled: {
    title: "Access is disabled",
    body: "This account cannot currently open an Oasis workspace. Contact your Manager or Oasis support.",
  },
  pending: {
    title: "Invitation pending",
    body: "Finish the invitation before organisation information can be shown.",
  },
  setup: {
    title: "Setup required",
    body: "Your sign-in worked. A Manager must finish linking the account before care information can be opened.",
  },
  unavailable: {
    title: "Access is temporarily unavailable",
    body: "Oasis could not confirm access for this account. Try again or contact your Manager or Oasis support.",
  },
} as const;

export default async function AccessStatePage(
  props: {
    params: Promise<{ state: string }>;
  }
) {
  const params = await props.params;
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
        <p className="mt-5 text-xs text-slate-600">
          No care information has been loaded.
        </p>
      </section>
    </main>
  );
}
