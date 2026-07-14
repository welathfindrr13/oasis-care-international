export const SHIFT_CLOCK_OUT_PROOF_VERSION = 3;

const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const MINIMUM_SECRET_BYTES = 32;
// Keep parsing and verification work bounded. Rotation must stop at capacity;
// callers must never evict a key that still signs a retryable persisted proof.
const MAXIMUM_PREVIOUS_KEYS = 4;

export type ShiftIdempotencyKey = {
  id: string;
  secret: Buffer;
};

export type ShiftIdempotencyKeyRing = {
  current: ShiftIdempotencyKey;
  verificationKeys: ReadonlyMap<string, ShiftIdempotencyKey>;
};

export class ShiftIdempotencyKeyRingConfigError extends Error {
  constructor() {
    super('Shift idempotency key-ring configuration is invalid');
    this.name = 'ShiftIdempotencyKeyRingConfigError';
  }
}

function invalidConfig(): never {
  throw new ShiftIdempotencyKeyRingConfigError();
}

function parseKeyId(value: unknown): string {
  const id = String(value || '').trim();
  if (!KEY_ID_PATTERN.test(id)) invalidConfig();
  return id;
}

function parseSecret(value: unknown): Buffer {
  const encoded = String(value || '').trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    invalidConfig();
  }
  const secret = Buffer.from(encoded, 'base64');
  if (
    secret.length < MINIMUM_SECRET_BYTES ||
    secret.toString('base64') !== encoded
  ) {
    invalidConfig();
  }
  return secret;
}

export function loadShiftIdempotencyKeyRing(
  environment: NodeJS.ProcessEnv = process.env,
): ShiftIdempotencyKeyRing {
  const current: ShiftIdempotencyKey = {
    id: parseKeyId(environment.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID),
    secret: parseSecret(environment.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET),
  };

  let previousValues: unknown;
  try {
    previousValues = JSON.parse(
      String(environment.SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON || '[]'),
    );
  } catch {
    invalidConfig();
  }
  if (!Array.isArray(previousValues) || previousValues.length > MAXIMUM_PREVIOUS_KEYS) {
    invalidConfig();
  }

  const verificationKeys = new Map<string, ShiftIdempotencyKey>([[current.id, current]]);
  for (const value of previousValues) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalidConfig();
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).some((key) => !['id', 'secret'].includes(key)) ||
      !Object.prototype.hasOwnProperty.call(record, 'id') ||
      !Object.prototype.hasOwnProperty.call(record, 'secret')
    ) {
      invalidConfig();
    }
    const key: ShiftIdempotencyKey = {
      id: parseKeyId(record.id),
      secret: parseSecret(record.secret),
    };
    if (verificationKeys.has(key.id)) invalidConfig();
    verificationKeys.set(key.id, key);
  }

  return { current, verificationKeys };
}
