export const MEDICATION_WALL_TIME_PATTERN = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;

export interface NormalizedMedicationWallTime {
  hours: number;
  minutes: number;
  canonical: string;
}

export function normalizeMedicationWallTime(
  value: unknown,
): NormalizedMedicationWallTime | null {
  if (typeof value !== 'string' || !MEDICATION_WALL_TIME_PATTERN.test(value)) {
    return null;
  }

  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return {
    hours,
    minutes,
    canonical: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

export function medicationWallTimeUniquenessKey(value: unknown): unknown {
  return normalizeMedicationWallTime(value)?.canonical ?? value;
}
