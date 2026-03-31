import Link from 'next/link';
import type { CarePlanVersion } from '../../../lib/graphql/queries';
import { formatCarePlanDate, getCareGuidanceSections } from '../../../lib/care-plan';

interface VisitCareGuidancePanelProps {
  carePlan?: CarePlanVersion | null;
  clientId?: string;
  isAdmin: boolean;
}

export function VisitCareGuidancePanel({ carePlan, clientId, isAdmin }: VisitCareGuidancePanelProps) {
  if (!carePlan) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">No active care plan is published for this client yet.</p>
        <p className="mt-2 text-sm text-amber-800">
          {isAdmin
            ? 'Publish structured care guidance from the client record so carers can see it here before the visit starts.'
            : 'Follow the visit record and escalate missing guidance to your coordinator before providing care.'}
        </p>
        {isAdmin && clientId && (
          <Link
            href={`/clients/${clientId}/care-plan`}
            className="mt-3 inline-flex text-sm font-medium text-amber-900 underline underline-offset-2"
          >
            Open client care plan
          </Link>
        )}
      </div>
    );
  }

  const sections = getCareGuidanceSections(carePlan);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
        <p className="text-sm font-semibold text-teal-900">
          Active care guidance · version {carePlan.versionNumber}
        </p>
        <p className="mt-1 text-sm text-teal-800">
          Approved {formatCarePlanDate(carePlan.approvedAt)} · Review due {formatCarePlanDate(carePlan.reviewDueAt)}
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{section.title}</h3>
            {section.body && <p className="mt-2 text-sm text-slate-700">{section.body}</p>}
            {section.bullets.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
