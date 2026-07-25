export const FAMILY_CONCERN_STATUS_LABELS: Record<string, string> = {
  OPEN: "Sent",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "Being reviewed",
  ESCALATED: "Escalated for review",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const FAMILY_CONCERN_EVENT_LABELS: Record<string, string> = {
  RAISED: "Sent",
  ACKNOWLEDGED: "Acknowledged",
  RESPONDED: "Status updated",
  RESOLVED: "Resolved",
  REOPENED: "Reopened",
  ESCALATED: "Escalated for review",
};

export function familyConcernStatusLabel(status: string) {
  return FAMILY_CONCERN_STATUS_LABELS[status] ?? "Status unavailable";
}

export function familyConcernEventLabel(eventType: string) {
  return FAMILY_CONCERN_EVENT_LABELS[eventType] ?? "Status updated";
}
