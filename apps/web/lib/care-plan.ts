import type { CarePlanContent, CarePlanVersion } from './graphql/queries';
import { formatDate, formatDateInputValueInLondon } from './time';

const CARE_PLAN_SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  goalsAndOutcomes: 'Goals and outcomes',
  dailyRoutines: 'Daily routine',
  personalCareSupport: 'Personal care',
  mobilityAndTransfers: 'Mobility and transfers',
  nutritionAndHydration: 'Nutrition and hydration',
  medicationSupport: 'Medication support',
  communicationAndAccessibility: 'Communication and accessibility',
  risksAndRedFlags: 'Risks and red flags',
  contingencyAndEscalation: 'Contingency and escalation',
  representativesAndInvolvement: 'Representatives and involvement',
};

export const EMPTY_CARE_PLAN_CONTENT: CarePlanContent = {
  overview: {
    summary: '',
    strengths: [],
    preferences: [],
  },
  goalsAndOutcomes: {
    goals: [],
    desiredOutcomes: [],
  },
  dailyRoutines: {
    morning: '',
    midday: '',
    evening: '',
    overnight: '',
  },
  personalCareSupport: {
    bathing: '',
    dressing: '',
    toileting: '',
    grooming: '',
  },
  mobilityAndTransfers: {
    mobilitySummary: '',
    transferGuidance: '',
    equipment: [],
  },
  nutritionAndHydration: {
    nutritionSummary: '',
    hydrationSupport: '',
    dietaryNeeds: [],
  },
  medicationSupport: {
    levelOfSupport: '',
    keyInstructions: '',
    refusalEscalation: '',
  },
  communicationAndAccessibility: {
    communicationApproach: '',
    communicationNeeds: [],
    accessibilityAdjustments: [],
  },
  risksAndRedFlags: {
    items: [],
  },
  contingencyAndEscalation: {
    summary: '',
    actions: [],
    escalationTriggers: [],
  },
  representativesAndInvolvement: {
    summary: '',
    involvedPeople: [],
  },
};

export function toDateInputValue(value?: string | null) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return formatDateInputValueInLondon(parsed);
}

export function listToMultiline(value?: string[] | null) {
  return (value ?? []).join('\n');
}

export function multilineToList(value: string) {
  return Array.from(
    new Set(
      value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function formatCarePlanDate(value?: string | null) {
  return value ? formatDate(value) : 'Not scheduled';
}

export function getCarePlanSummary(version?: CarePlanVersion | null) {
  if (!version) {
    return [];
  }

  const content = version.content;
  const summary: string[] = [];

  if (content.overview.summary) {
    summary.push(content.overview.summary);
  }
  if (content.communicationAndAccessibility.communicationApproach) {
    summary.push(content.communicationAndAccessibility.communicationApproach);
  }
  if (content.mobilityAndTransfers.transferGuidance) {
    summary.push(content.mobilityAndTransfers.transferGuidance);
  }
  if (content.contingencyAndEscalation.summary) {
    summary.push(content.contingencyAndEscalation.summary);
  }

  return summary.slice(0, 3);
}

export function getCarePlanHighlights(version?: CarePlanVersion | null) {
  if (!version) {
    return [];
  }

  const content = version.content;
  const highlights = [
    {
      label: 'Day-to-day guidance',
      body: content.dailyRoutines.morning || content.overview.summary,
    },
    {
      label: 'Mobility and transfers',
      body: content.mobilityAndTransfers.transferGuidance || content.mobilityAndTransfers.mobilitySummary,
    },
    {
      label: 'Communication approach',
      body: content.communicationAndAccessibility.communicationApproach,
    },
    {
      label: 'Escalation',
      body: content.contingencyAndEscalation.summary || content.medicationSupport.refusalEscalation,
    },
  ];

  return highlights.filter((item) => item.body).slice(0, 4);
}

export function formatCarePlanAuditAction(action: string) {
  switch (action) {
    case 'CREATE_CARE_PLAN_DRAFT':
      return 'Draft created';
    case 'UPDATE_CARE_PLAN_DRAFT':
      return 'Draft updated';
    case 'PUBLISH_CARE_PLAN_DRAFT':
      return 'Draft published';
    case 'DISCARD_CARE_PLAN_DRAFT':
      return 'Draft discarded';
    default:
      return action
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
}

export function formatCarePlanChangedSections(changedSections?: string[] | null) {
  const labels = (changedSections ?? [])
    .map((section) => CARE_PLAN_SECTION_LABELS[section] ?? section)
    .filter(Boolean);

  if (!labels.length) {
    return 'No section-level summary recorded';
  }

  return labels.join(', ');
}

export function getCareGuidanceSections(version?: CarePlanVersion | null) {
  if (!version) {
    return [];
  }

  const content = version.content;
  const sections = [
    {
      title: 'Overview',
      body: content.overview.summary,
      bullets: [...content.overview.strengths, ...content.overview.preferences].slice(0, 4),
    },
    {
      title: 'Daily routine',
      body: [content.dailyRoutines.morning, content.dailyRoutines.midday, content.dailyRoutines.evening, content.dailyRoutines.overnight]
        .filter(Boolean)
        .join(' '),
      bullets: [],
    },
    {
      title: 'Mobility and transfers',
      body: [content.mobilityAndTransfers.mobilitySummary, content.mobilityAndTransfers.transferGuidance]
        .filter(Boolean)
        .join(' '),
      bullets: content.mobilityAndTransfers.equipment,
    },
    {
      title: 'Medication support',
      body: [content.medicationSupport.levelOfSupport, content.medicationSupport.keyInstructions, content.medicationSupport.refusalEscalation]
        .filter(Boolean)
        .join(' '),
      bullets: [],
    },
    {
      title: 'Communication and accessibility',
      body: content.communicationAndAccessibility.communicationApproach,
      bullets: [
        ...content.communicationAndAccessibility.communicationNeeds,
        ...content.communicationAndAccessibility.accessibilityAdjustments,
      ].slice(0, 5),
    },
    {
      title: 'Risks and red flags',
      body: '',
      bullets: content.risksAndRedFlags.items.map((item) =>
        item.escalationTrigger
          ? `${item.title}: ${item.guidance} Escalate when ${item.escalationTrigger}.`
          : `${item.title}: ${item.guidance}`
      ),
    },
    {
      title: 'Contingency and escalation',
      body: content.contingencyAndEscalation.summary,
      bullets: [...content.contingencyAndEscalation.actions, ...content.contingencyAndEscalation.escalationTriggers].slice(0, 6),
    },
  ];

  return sections.filter((section) => section.body || section.bullets.length > 0);
}
