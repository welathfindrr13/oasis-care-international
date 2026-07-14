import {
  loadShiftIdempotencyKeyRing,
  ShiftIdempotencyKeyRingConfigError,
} from './shift-idempotency-keyring';

const currentSecret = Buffer.alloc(32, 1).toString('base64');
const previousSecret = Buffer.alloc(32, 2).toString('base64');

describe('shift idempotency key-ring configuration', () => {
  it('loads one current signing key and controlled previous verification keys', () => {
    const ring = loadShiftIdempotencyKeyRing({
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID: 'shift-2026-07',
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET: currentSecret,
      SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: JSON.stringify([
        { id: 'shift-2026-06', secret: previousSecret },
      ]),
    });

    expect(ring.current.id).toBe('shift-2026-07');
    expect(ring.verificationKeys.get('shift-2026-07')?.secret).toEqual(
      Buffer.alloc(32, 1),
    );
    expect(ring.verificationKeys.get('shift-2026-06')?.secret).toEqual(
      Buffer.alloc(32, 2),
    );
  });

  it('accepts four previous keys and fails closed instead of evicting a fifth', () => {
    const previousKeys = Array.from({ length: 4 }, (_, index) => ({
      id: `shift-previous-${index + 1}`,
      secret: Buffer.alloc(32, index + 2).toString('base64'),
    }));
    const environment = {
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID: 'shift-current',
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET: currentSecret,
      SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: JSON.stringify(previousKeys),
    };

    expect(loadShiftIdempotencyKeyRing(environment).verificationKeys.size).toBe(5);
    expect(() =>
      loadShiftIdempotencyKeyRing({
        ...environment,
        SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: JSON.stringify([
          ...previousKeys,
          {
            id: 'shift-previous-5',
            secret: Buffer.alloc(32, 6).toString('base64'),
          },
        ]),
      }),
    ).toThrow(ShiftIdempotencyKeyRingConfigError);
  });

  it.each([
    {},
    {
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID: 'INVALID KEY',
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET: currentSecret,
    },
    {
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID: 'shift-current',
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET: Buffer.alloc(31, 1).toString('base64'),
    },
    {
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID: 'shift-current',
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET: currentSecret,
      SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: 'not-json',
    },
    {
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID: 'shift-current',
      SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET: currentSecret,
      SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: JSON.stringify([
        { id: 'shift-current', secret: previousSecret },
      ]),
    },
  ])('rejects missing, weak, malformed, or duplicate key configuration', (environment) => {
    expect(() => loadShiftIdempotencyKeyRing(environment)).toThrow(
      ShiftIdempotencyKeyRingConfigError,
    );
  });
});
