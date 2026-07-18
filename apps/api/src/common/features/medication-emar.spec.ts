import { BaseHttpException } from '../errors/base-http.exception';
import { ErrorCode } from '../errors/error-codes';
import {
  assertMedicationEmarEnabled,
  containsMedicationEmarContent,
  isMedicationEmarEnabled,
  MEDICATION_EMAR_DISABLED_MESSAGE,
} from './medication-emar';

describe('medication/eMAR launch boundary', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['   ', false],
    ['false', false],
    ['TRUE', false],
    ['1', false],
    ['enabled', false],
    [' true ', true],
    ['true', true],
  ])('parses %p as %p', (value, expected) => {
    expect(isMedicationEmarEnabled(value)).toBe(expected);
  });

  it('uses a stable feature-not-enabled response while disabled', () => {
    expect(() => assertMedicationEmarEnabled('false')).toThrow(
      expect.objectContaining({
        response: {
          code: ErrorCode.FEATURE_NOT_ENABLED,
          message: MEDICATION_EMAR_DISABLED_MESSAGE,
        },
        status: 403,
      }) as BaseHttpException,
    );
  });

  it('detects medication content in legacy text and structured story fields', () => {
    expect(containsMedicationEmarContent('Medication support was recorded')).toBe(true);
    expect(containsMedicationEmarContent({ body: 'An eMAR update is ready' })).toBe(true);
    expect(containsMedicationEmarContent('The care visit was completed')).toBe(false);
  });
});
