import Link from "next/link";
import { Header } from "../../../components/oasis/Header";
import { query } from "../../../lib/graphql/client";

const ORGANIZATION_SETUP_DETAILS = `
  query OrganizationSetupDetails {
    viewerOrganizationSetupDetails {
      id
      name
    }
  }
`;

export const dynamic = "force-dynamic";

const steps = [
  {
    title: "Review organization and account details",
    description:
      "Confirm your authenticated administrator profile and current organization access.",
    href: "/settings",
    action: "Review settings",
  },
  {
    title: "Add one synthetic person",
    description:
      "For the production canary, use clearly synthetic details. Do not enter real care-recipient data.",
    href: "/people/new",
    action: "Add synthetic person",
  },
  {
    title: "Set up the workforce",
    description:
      "Create and link the minimum synthetic carer profile needed for the canary.",
    href: "/admin/carers",
    action: "Open carer directory",
  },
  {
    title: "Schedule a synthetic visit",
    description:
      "Create the first canary visit only after the synthetic person and carer are ready.",
    href: "/schedule/new",
    action: "Schedule visit",
  },
  {
    title: "Review the family-safe workspace",
    description:
      "See where approved updates and concerns will be managed without exposing raw care records.",
    href: "/family-updates",
    action: "Review family updates",
  },
];

export default async function AdminSetupPage() {
  const { viewerOrganizationSetupDetails: organization } = await query<{
    viewerOrganizationSetupDetails: { id: string; name: string };
  }>(ORGANIZATION_SETUP_DETAILS);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-800">
          Guided setup
        </p>
        <h1 className="font-heading text-4xl font-black tracking-tight">
          Prepare your Oasis workspace
        </h1>
        <p className="mb-8 text-slate-600">
          Complete this checklist with synthetic data during the production
          canary. Billing is not part of this setup.
        </p>
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 font-black text-teal-900">
                {index + 1}
              </span>
              <div>
                <h2 className="font-heading text-xl font-black text-slate-950">
                  {step.title}
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
                {index === 0 && (
                  <dl className="mb-3 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div>
                      <dt className="font-bold text-slate-700">Organization</dt>
                      <dd className="text-slate-950">{organization.name}</dd>
                    </div>
                    <div className="mt-2">
                      <dt className="font-bold text-slate-700">
                        Internal organization ID
                      </dt>
                      <dd className="font-mono text-xs text-slate-600">
                        {organization.id}
                      </dd>
                    </div>
                  </dl>
                )}
                <Link
                  href={step.href}
                  className="text-sm font-bold text-teal-800"
                >
                  {step.action} →
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
