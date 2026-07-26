export type VisitProgressTask = {
  isCompleted: boolean;
  hasRecordedOutcome: boolean;
};

export function hasRecordedVisitCare(
  tasks: VisitProgressTask[],
  careLogCount: number,
): boolean {
  return (
    tasks.some((task) => task.isCompleted || task.hasRecordedOutcome) ||
    careLogCount > 0
  );
}
