import { validateSync } from 'class-validator';
import { CreatePrescriptionInput } from './create-prescription.input';

function prescriptionInput(administrationTimes: string[]): CreatePrescriptionInput {
  return Object.assign(new CreatePrescriptionInput(), {
    clientId: 'client-123',
    medicationId: 'medication-123',
    startDate: '2026-07-13',
    endDate: '2026-07-13',
    frequencyPerDay: 1,
    administrationTimes,
  });
}

describe('CreatePrescriptionInput administration times', () => {
  it.each([
    { administrationTimes: [], constraint: 'arrayMinSize', label: 'an empty schedule' },
    {
      administrationTimes: ['not-a-time'],
      constraint: 'matches',
      label: 'an invalid format',
    },
    {
      administrationTimes: ['25:00'],
      constraint: 'matches',
      label: 'an out-of-range time',
    },
    {
      administrationTimes: ['08:00', '08:00'],
      constraint: 'arrayUnique',
      label: 'an identical duplicate',
    },
    {
      administrationTimes: ['8:00', '08:00'],
      constraint: 'arrayUnique',
      label: 'a canonical duplicate',
    },
  ])('rejects $label', ({ administrationTimes, constraint }) => {
    const error = validateSync(prescriptionInput(administrationTimes)).find(
      ({ property }) => property === 'administrationTimes',
    );

    expect(error?.constraints).toHaveProperty(constraint);
  });

  it('accepts one valid single-digit-hour wall time', () => {
    expect(validateSync(prescriptionInput(['8:00']))).toEqual([]);
  });
});
