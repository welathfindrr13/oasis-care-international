import { ShiftService } from './shift.service';

describe('ShiftService organization timezone ranges', () => {
  it('uses the 25-hour organization day at the autumn clock change', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
    const service = new ShiftService({} as any);

    const range = (service as any).getRange(undefined, undefined, 'org-123');

    expect(range).toEqual({
      from: new Date('2026-10-24T23:00:00.000Z'),
      to: new Date('2026-10-25T23:59:59.999Z'),
    });
    jest.useRealTimers();
  });
});
