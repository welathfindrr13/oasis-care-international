import type { ShiftVerificationMethod } from "../../lib/graphql/queries";

export function shiftVerificationLabel(
  method: ShiftVerificationMethod,
): string {
  if (method === "GPS") return "Location recorded";
  if (method === "MANUAL") return "Manual check";
  if (method === "QR") return "QR code";
  if (method === "NFC") return "NFC";
  return "Phone check";
}

export function todayShiftAction({
  active,
  unavailable,
}: {
  active: boolean;
  unavailable: boolean;
}): string {
  if (unavailable) return "Try shift status again";
  return active ? "Manage active shift" : "Clock in";
}
