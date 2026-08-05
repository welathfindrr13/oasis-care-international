export const MAX_VISIT_CARE_TASKS = 20;
export const MAX_VISIT_CARE_TASK_LABEL_LENGTH = 120;

export interface VisitCareTaskRow {
  id: string;
  label: string;
}

export interface VisitCareTaskValidation {
  labels: string[];
  fieldErrors: Record<string, string>;
  listError: string | null;
}

export function validateVisitCareTasks(
  rows: VisitCareTaskRow[],
): VisitCareTaskValidation {
  const fieldErrors: Record<string, string> = {};

  if (rows.length > MAX_VISIT_CARE_TASKS) {
    return {
      labels: [],
      fieldErrors,
      listError: `Add no more than ${MAX_VISIT_CARE_TASKS} care tasks.`,
    };
  }

  const labels = rows.map((row) => {
    const label = row.label.trim();
    if (!label) {
      fieldErrors[row.id] = "Enter a care task or remove this row.";
    } else if (label.length > MAX_VISIT_CARE_TASK_LABEL_LENGTH) {
      fieldErrors[row.id] =
        `Care tasks must be ${MAX_VISIT_CARE_TASK_LABEL_LENGTH} characters or fewer.`;
    }
    return label;
  });

  return {
    labels,
    fieldErrors,
    listError:
      Object.keys(fieldErrors).length > 0 ? "Check the care tasks." : null,
  };
}

export function isUncertainVisitSubmissionError(error: unknown): boolean {
  const status =
    error && typeof error === "object" && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;
  if (typeof status === "number" && status >= 500 && status <= 599) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("timed out") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("load failed")
  );
}
