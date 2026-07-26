import type {
  CreateEvidencePackItemInput,
  InspectionAssessmentRecord,
  InspectionCarePlanRecord,
  InspectionRecord,
  InspectionRecordSourceType,
  InspectionSourceCandidate,
} from "./graphql/queries";

export const INSPECTION_RECORD_SOURCE_TYPES = [
  "VISIT",
  "CARE_LOG",
  "CONCERN",
  "ASSESSMENT",
  "CARE_PLAN",
] as const satisfies readonly InspectionRecordSourceType[];

const SOURCE_TYPE_LABELS: Record<InspectionRecordSourceType, string> = {
  VISIT: "Visits",
  CARE_LOG: "Care notes",
  CONCERN: "Concerns",
  ASSESSMENT: "Assessments",
  CARE_PLAN: "Care plans",
};

const SOURCE_HEADLINES: Record<InspectionRecordSourceType, string> = {
  VISIT: "Visit record",
  CARE_LOG: "Care note record",
  CONCERN: "Concern record",
  ASSESSMENT: "Assessment record",
  CARE_PLAN: "Care plan version",
};

export function isInspectionRecordSourceType(
  value: string,
): value is InspectionRecordSourceType {
  return (INSPECTION_RECORD_SOURCE_TYPES as readonly string[]).includes(value);
}

export function inspectionRecordTypeLabel(
  sourceType: InspectionRecordSourceType,
): string {
  return SOURCE_TYPE_LABELS[sourceType];
}

function inspectionSourceKey(
  source: Pick<InspectionSourceCandidate, "sourceType" | "id">,
): string {
  return `${source.sourceType}:${source.id}`;
}

export function reconcileInspectionSourceSelections(
  selectedSources: InspectionSourceCandidate[],
  availableCandidates: InspectionSourceCandidate[],
): InspectionSourceCandidate[] {
  const candidatesByKey = new Map(
    availableCandidates.map((candidate) => [
      inspectionSourceKey(candidate),
      candidate,
    ]),
  );

  return selectedSources.flatMap((selected) => {
    const currentCandidate = candidatesByKey.get(inspectionSourceKey(selected));
    return currentCandidate ? [currentCandidate] : [];
  });
}

export function buildInspectionRecordItems({
  assessments,
  carePlans,
  operationalSources,
}: {
  assessments: InspectionAssessmentRecord[];
  carePlans: InspectionCarePlanRecord[];
  operationalSources: InspectionSourceCandidate[];
}): CreateEvidencePackItemInput[] {
  const selected = [
    ...assessments.map((assessment) => ({
      id: assessment.id,
      sourceType: "ASSESSMENT" as const,
      occurredAt: assessment.completedAt ?? assessment.createdAt,
    })),
    ...carePlans.map((plan) => ({
      id: plan.id,
      sourceType: "CARE_PLAN" as const,
      occurredAt: plan.approvedAt ?? plan.effectiveFrom ?? plan.createdAt,
    })),
    ...operationalSources,
  ];

  const seen = new Set<string>();
  return selected.map((source) => {
    if (!isInspectionRecordSourceType(source.sourceType)) {
      throw new Error("INSPECTION_RECORD_SOURCE_NOT_PERMITTED");
    }

    const key = `${source.sourceType}:${source.id}`;
    if (seen.has(key)) {
      throw new Error("INSPECTION_RECORD_SOURCE_DUPLICATE");
    }
    seen.add(key);

    return {
      sourceType: source.sourceType,
      sourceId: source.id,
      occurredAt: source.occurredAt ?? undefined,
      headline: SOURCE_HEADLINES[source.sourceType],
    };
  });
}

export interface InspectionRecordGroup {
  sourceType: InspectionRecordSourceType;
  label: string;
  count: number;
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
}

export function groupInspectionRecordItems(
  items: Array<{
    sourceType: string;
    occurredAt?: string | null;
  }>,
): InspectionRecordGroup[] {
  const grouped = new Map<
    InspectionRecordSourceType,
    { count: number; dates: string[] }
  >();

  for (const item of items) {
    if (!isInspectionRecordSourceType(item.sourceType)) {
      continue;
    }
    const current = grouped.get(item.sourceType) ?? { count: 0, dates: [] };
    current.count += 1;
    if (item.occurredAt) current.dates.push(item.occurredAt);
    grouped.set(item.sourceType, current);
  }

  return INSPECTION_RECORD_SOURCE_TYPES.flatMap((sourceType) => {
    const group = grouped.get(sourceType);
    if (!group) return [];
    const dates = [...group.dates].sort();
    return [
      {
        sourceType,
        label: inspectionRecordTypeLabel(sourceType),
        count: group.count,
        firstOccurredAt: dates[0] ?? null,
        lastOccurredAt: dates.at(-1) ?? null,
      },
    ];
  });
}

export interface InspectionRecordDocument {
  clientName: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  publishedAt: string | null;
  includedRecords: InspectionRecordGroup[];
}

export function buildInspectionRecordDocument(
  pack: InspectionRecord,
  clientName: string,
): InspectionRecordDocument {
  return {
    clientName,
    status: pack.status,
    periodStart: pack.periodStart,
    periodEnd: pack.periodEnd,
    generatedAt: pack.generatedAt,
    publishedAt: pack.publishedAt ?? null,
    includedRecords: groupInspectionRecordItems(pack.items),
  };
}

export interface InspectionRecordValidationErrors {
  periodStart?: string;
  periodEnd?: string;
  sources?: string;
}

export function validateInspectionRecordForm({
  periodStart,
  periodEnd,
  selectedSourceCount,
}: {
  periodStart: string;
  periodEnd: string;
  selectedSourceCount: number;
}): InspectionRecordValidationErrors {
  const errors: InspectionRecordValidationErrors = {};
  if (!periodStart) errors.periodStart = "Enter the start of the period.";
  if (!periodEnd) errors.periodEnd = "Enter the end of the period.";
  if (periodStart && periodEnd && periodEnd < periodStart) {
    errors.periodEnd = "The end of the period must be on or after the start.";
  }
  if (selectedSourceCount === 0) {
    errors.sources = "Choose at least one record to include.";
  }
  return errors;
}

export function shouldShowRequestedClientUnavailable({
  clientListUnavailable,
  requestedClientInvalid,
  requestedClientId,
  selectedClientAvailable,
}: {
  clientListUnavailable: boolean;
  requestedClientInvalid: boolean;
  requestedClientId?: string;
  selectedClientAvailable: boolean;
}): boolean {
  return (
    !clientListUnavailable &&
    (requestedClientInvalid ||
      Boolean(requestedClientId && !selectedClientAvailable))
  );
}
