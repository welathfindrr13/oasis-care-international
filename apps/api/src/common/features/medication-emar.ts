import { HttpStatus } from '@nestjs/common';
import { BaseHttpException } from '../errors/base-http.exception';
import { ErrorCode } from '../errors/error-codes';

export const MEDICATION_EMAR_DISABLED_MESSAGE =
  'Medication and eMAR are not enabled for this launch.';

export function isMedicationEmarEnabled(
  value: unknown = process.env.MEDICATION_EMAR_ENABLED,
): boolean {
  return typeof value === 'string' && value.trim() === 'true';
}

export function assertMedicationEmarEnabled(
  value: unknown = process.env.MEDICATION_EMAR_ENABLED,
): void {
  if (isMedicationEmarEnabled(value)) return;
  throw new BaseHttpException(
    ErrorCode.FEATURE_NOT_ENABLED,
    MEDICATION_EMAR_DISABLED_MESSAGE,
    HttpStatus.FORBIDDEN,
  );
}

export function containsMedicationEmarContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return /medication|\bemar\b/i.test(text);
  } catch {
    return true;
  }
}
