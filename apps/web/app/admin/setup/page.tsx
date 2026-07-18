import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "../../../components/oasis/Header";
import { Button } from "../../../components/ui/Button";
import { query } from "../../../lib/graphql/client";

const ORGANIZATION_SETUP_DETAILS = `
  query OrganizationSetupDetails {
    viewerOrganizationSetupDetails {
      name
    }
  }
`;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up your company | Oasis Care",
};

const steps = [
  {
    title: "Add a person",
    description: "Create the first person profile so you can plan their care.",
    href: "/people/new",
    action: "Add a person",
  },
  {
    title: "Invite a carer",
    description:
      "Invite a carer to join your company. They must accept the invitation before you can assign them to a visit.",
    href: "/admin/carers",
    action: "Invite a carer",
  },
  {
    title: "Schedule a visit",
    description:
      "Choose a person, date and time, then assign a carer who has accepted their invitation.",
    href: "/schedule/new",
    action: "Schedule a visit",
  },
  {
    title: "Set up family updates",
    description:
      "Open a person profile when you are ready to manage safe Family access and approved updates.",
    href: "/people",
    action: "View people",
  },
] as const;

export default async function AdminSetupPage() {
  const { viewerOrganizationSetupDetails: organization } = await query<{
    viewerOrganizationSetupDetails: { name: string };
  }>(ORGANIZATION_SETUP_DETAILS);

  return (
    <div className="min-h-screen bg-oasis-canvas">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-semibold text-oasis-teal-dark">Company setup</p>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-oasis-ink sm:text-4xl">
          Set up your company
        </h1>
        <p className="mt-3 text-lg leading-7 text-oasis-muted">
          {organization.name}
        </p>
        <p className="mt-5 max-w-2xl leading-7 text-oasis-muted">
          Follow these steps to prepare your company for its first visit. You
          can return to this page at any time.
        </p>

        <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
          <Link href="/people/new">Add a person</Link>
        </Button>

        <ol className="mt-10 border-t border-oasis-border">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-[2.75rem_1fr] gap-3 border-b border-oasis-border py-6 sm:grid-cols-[3rem_1fr_auto] sm:items-start sm:gap-5"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-oasis-teal-soft font-bold text-oasis-teal-dark"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div>
                <h2 className="font-heading text-xl font-bold text-oasis-ink">
                  {step.title}
                </h2>
                <p className="mt-2 max-w-xl leading-6 text-oasis-muted">
                  {step.description}
                </p>
              </div>
              <Link
                href={step.href}
                className="col-start-2 flex min-h-11 items-center font-semibold text-oasis-teal-dark sm:col-start-3"
              >
                {step.action}
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
