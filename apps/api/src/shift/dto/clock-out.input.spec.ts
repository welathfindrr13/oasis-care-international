import { validate } from 'class-validator';
import { ShiftVerificationMethod } from '@oasis/db';
import { ClockOutInput } from './clock-out.input';

describe('ClockOutInput', () => {
  it('requires a UUID shift identifier', async () => {
    const missingShiftId = Object.assign(new ClockOutInput(), {
      method: ShiftVerificationMethod.MANUAL,
    });
    const invalidShiftId = Object.assign(new ClockOutInput(), {
      shiftId: 'not-a-shift-id',
      method: ShiftVerificationMethod.MANUAL,
    });

    const [missingErrors, invalidErrors] = await Promise.all([
      validate(missingShiftId),
      validate(invalidShiftId),
    ]);

    expect(missingErrors.some((error) => error.property === 'shiftId')).toBe(true);
    expect(invalidErrors.some((error) => error.property === 'shiftId')).toBe(true);
  });

  it('accepts a valid shift identifier', async () => {
    const input = Object.assign(new ClockOutInput(), {
      shiftId: '11111111-1111-4111-8111-111111111111',
      method: ShiftVerificationMethod.MANUAL,
    });

    const errors = await validate(input);

    expect(errors.filter((error) => error.property === 'shiftId')).toEqual([]);
  });
});
