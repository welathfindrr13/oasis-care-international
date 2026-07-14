import { ShiftVerificationMethod } from '@oasis/db';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import type { CanonicalCapabilityActor } from '../auth/access-capability';
import { ShiftService } from './shift.service';

describe('ShiftService integrity', () => {
  const managedEnvironmentKeys = [
    'SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID',
    'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET',
    'SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON',
    'JWT_SECRET',
  ] as const;
  const originalEnvironment = Object.fromEntries(
    managedEnvironmentKeys.map((key) => [key, process.env[key]]),
  );
  const currentSecret = Buffer.alloc(32, 1).toString('base64');
  const previousSecret = Buffer.alloc(32, 2).toString('base64');
  const organizationId = 'org-1';
  const carerId = 'carer-1';
  const actor: CanonicalCapabilityActor = {
    authenticated: true,
    authSubject: 'subject-1',
    identityProvider: 'clerk',
    organizationId,
    membershipId: 'membership-1',
    membershipState: 'ACTIVE',
    rawRole: 'carer',
    effectiveRole: 'carer',
    surface: 'STAFF',
    linkedIdentityState: 'LINKED',
    onboardingState: 'READY',
    domainIdentityId: carerId,
  };

  beforeEach(() => {
    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID = 'shift-current';
    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET = currentSecret;
    process.env.SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON = '[]';
    process.env.JWT_SECRET = 'unrelated-jwt-test-secret-32-bytes-minimum';
  });

  afterAll(() => {
    for (const key of managedEnvironmentKeys) {
      const original = originalEnvironment[key];
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  });

  function shift(overrides: Record<string, unknown> = {}) {
    return {
      id: 'shift-1',
      organization_id: organizationId,
      carer_id: carerId,
      clock_in_at: new Date('2026-07-13T08:00:00.000Z'),
      clock_out_at: null,
      clock_in_method: ShiftVerificationMethod.MANUAL,
      clock_out_method: null,
      clock_in_lat: null,
      clock_in_lng: null,
      clock_in_accuracy_m: null,
      clock_out_lat: null,
      clock_out_lng: null,
      clock_out_accuracy_m: null,
      clock_in_source: 'web',
      clock_out_source: null,
      clock_in_reason_code: null,
      clock_out_reason_code: null,
      location_consent_at: new Date('2026-07-13T08:00:00.000Z'),
      notes: 'Initial shift note',
      created_at: new Date('2026-07-13T08:00:00.000Z'),
      updated_at: new Date('2026-07-13T08:00:00.000Z'),
      deleted_at: null,
      ...overrides,
    };
  }

  function createService() {
    const repository = {
      findCarerById: jest.fn(),
      findActiveShiftByCarerId: jest.fn(),
      findShiftByIdForCarer: jest.fn(),
      createShift: jest.fn(),
      closeShift: jest.fn(),
    } as any;
    return { repository, service: new ShiftService(repository) };
  }

  function requestProof(audit: any, overrides: Record<string, unknown> = {}) {
    return {
      hmac: audit.requestFingerprint,
      keyId: audit.fingerprintKeyId,
      version: audit.fingerprintVersion,
      ...overrides,
    };
  }

  function expectDomainError(error: unknown, code: ErrorCode, message: string) {
    expect(error).toBeInstanceOf(BaseHttpException);
    expect((error as BaseHttpException).getResponse()).toEqual({
      code,
      message,
    });
  }

  it('maps a raced open-shift unique violation to SHIFT_ALREADY_ACTIVE', async () => {
    const { repository, service } = createService();
    repository.findCarerById.mockResolvedValue({ id: carerId });
    repository.findActiveShiftByCarerId.mockResolvedValue(null);
    repository.createShift.mockRejectedValue({ code: 'P2002' });

    await service
      .clockIn({ method: ShiftVerificationMethod.MANUAL }, carerId, 'carer', organizationId, actor)
      .then(
        () => fail('clock-in should reject'),
        (error) =>
          expectDomainError(error, ErrorCode.SHIFT_ALREADY_ACTIVE, 'You are already clocked in.'),
      );
  });

  it('returns the original closed shift for an identical retry', async () => {
    const { repository, service } = createService();
    const closed = shift({
      clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
      clock_out_method: ShiftVerificationMethod.MANUAL,
      clock_out_lat: 51.5,
      clock_out_lng: -0.1,
      clock_out_accuracy_m: 8,
      clock_out_source: 'mobile',
      clock_out_reason_code: 'END_SHIFT',
      notes: 'Finished safely',
    });
    repository.findShiftByIdForCarer.mockResolvedValue(closed);
    repository.closeShift.mockImplementation(
      async (_shiftId: string, _input: unknown, _carerId: string, _orgId: string, audit: any) => ({
        applied: false,
        shift: closed,
        requestProof: requestProof(audit),
      }),
    );

    const result = await service.clockOut(
      {
        shiftId: 'shift-1',
        method: ShiftVerificationMethod.MANUAL,
        latitude: 51.5,
        longitude: -0.1,
        accuracyMeters: 8,
        source: 'mobile',
        reasonCode: 'END_SHIFT',
        notes: 'Finished safely',
      },
      carerId,
      'carer',
      organizationId,
      actor,
    );

    expect(result.clockOutAt).toEqual(closed.clock_out_at);
    expect(repository.closeShift).toHaveBeenCalledWith(
      'shift-1',
      expect.any(Object),
      carerId,
      organizationId,
      expect.objectContaining({
        authSubject: 'subject-1',
        membershipId: 'membership-1',
        actorRole: 'carer',
        notesProvided: true,
        fingerprintKeyId: 'shift-current',
        fingerprintVersion: 3,
        requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(JSON.stringify(repository.closeShift.mock.calls[0][4])).not.toContain(
      currentSecret,
    );
  });

  it('rejects a conflicting retry without updating the first close record', async () => {
    const { repository, service } = createService();
    repository.findShiftByIdForCarer.mockResolvedValue(
      shift({
        clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
        clock_out_method: ShiftVerificationMethod.MANUAL,
        clock_out_source: 'mobile',
        notes: 'First close',
      }),
    );
    repository.closeShift.mockResolvedValue({
      applied: false,
      shift: shift({
        clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
        clock_out_method: ShiftVerificationMethod.MANUAL,
        clock_out_source: 'mobile',
        notes: 'First close',
      }),
      requestProof: null,
    });

    await service
      .clockOut(
        {
          shiftId: 'shift-1',
          method: ShiftVerificationMethod.GPS,
          source: 'web',
          notes: 'Conflicting close',
        },
        carerId,
        'carer',
        organizationId,
        actor,
      )
      .then(
        () => fail('clock-out should reject'),
        (error) =>
          expectDomainError(
            error,
            ErrorCode.SHIFT_NOT_ACTIVE,
            'This shift was already clocked out with different proof or notes.',
          ),
      );

    expect(repository.closeShift).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the dedicated current key is missing or weak', async () => {
    const { repository, service } = createService();
    repository.findShiftByIdForCarer.mockResolvedValue(shift());

    for (const secret of [undefined, Buffer.alloc(31, 1).toString('base64')]) {
      if (secret === undefined) delete process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET;
      else process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET = secret;

      await service
        .clockOut(
          {
            shiftId: 'shift-1',
            method: ShiftVerificationMethod.MANUAL,
            notes: 'Sensitive shift note',
          },
          carerId,
          'carer',
          organizationId,
          actor,
        )
        .then(
          () => fail('clock-out should fail closed'),
          (error) =>
            expectDomainError(
              error,
              ErrorCode.INTERNAL_ERROR,
              'Shift request verification is unavailable',
            ),
        );
    }

    expect(repository.closeShift).not.toHaveBeenCalled();
  });

  it('is independent from JWT rotation', async () => {
    const { repository, service } = createService();
    repository.findShiftByIdForCarer.mockResolvedValue(shift());
    let persistedProof: ReturnType<typeof requestProof> | null = null;
    repository.closeShift.mockImplementation(
      async (_shiftId: string, _input: unknown, _carerId: string, _orgId: string, audit: any) => {
        persistedProof ??= requestProof(audit);
        return {
          applied: persistedProof.hmac === audit.requestFingerprint,
          shift: shift({ clock_out_at: new Date('2026-07-13T10:00:00.000Z') }),
          requestProof: persistedProof,
        };
      },
    );
    const request = {
      shiftId: 'shift-1',
      method: ShiftVerificationMethod.MANUAL,
      notes: 'Sensitive shift note',
    };

    await service.clockOut(request, carerId, 'carer', organizationId, actor);
    const firstFingerprint = repository.closeShift.mock.calls[0][4].requestFingerprint;
    process.env.JWT_SECRET = 'rotated-unrelated-jwt-test-secret-32-bytes';
    await service.clockOut(request, carerId, 'carer', organizationId, actor);
    const secondFingerprint = repository.closeShift.mock.calls[1][4].requestFingerprint;

    expect(firstFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(secondFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(secondFingerprint).toBe(firstFingerprint);
  });

  it('verifies a historical proof with a configured previous key', async () => {
    const { repository, service } = createService();
    const closed = shift({ clock_out_at: new Date('2026-07-13T10:00:00.000Z') });
    let persistedProof: ReturnType<typeof requestProof> | null = null;
    repository.findShiftByIdForCarer.mockResolvedValue(closed);
    repository.closeShift.mockImplementation(
      async (_shiftId: string, _input: unknown, _carerId: string, _orgId: string, audit: any) => {
        persistedProof ??= requestProof(audit);
        return { applied: false, shift: closed, requestProof: persistedProof };
      },
    );
    const request = {
      shiftId: 'shift-1',
      method: ShiftVerificationMethod.MANUAL,
      notes: 'Historical retry',
    };

    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID = 'shift-previous';
    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET = previousSecret;
    await service.clockOut(request, carerId, 'carer', organizationId, actor);

    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID = 'shift-current';
    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET = currentSecret;
    process.env.SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON = JSON.stringify([
      { id: 'shift-previous', secret: previousSecret },
    ]);
    await expect(
      service.clockOut(request, carerId, 'carer', organizationId, actor),
    ).resolves.toBeDefined();
  });

  it('fails closed when a persisted proof key is removed instead of silently breaking idempotency', async () => {
    const { repository, service } = createService();
    const closed = shift({ clock_out_at: new Date('2026-07-13T10:00:00.000Z') });
    let persistedProof: ReturnType<typeof requestProof> | null = null;
    repository.findShiftByIdForCarer.mockResolvedValue(closed);
    repository.closeShift.mockImplementation(
      async (_shiftId: string, _input: unknown, _carerId: string, _orgId: string, audit: any) => {
        persistedProof ??= requestProof(audit);
        return { applied: false, shift: closed, requestProof: persistedProof };
      },
    );
    const request = {
      shiftId: 'shift-1',
      method: ShiftVerificationMethod.MANUAL,
      notes: 'Historical retry',
    };

    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID = 'shift-previous';
    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET = previousSecret;
    await service.clockOut(request, carerId, 'carer', organizationId, actor);

    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID = 'shift-current';
    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET = currentSecret;
    process.env.SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON = '[]';
    await service
      .clockOut(request, carerId, 'carer', organizationId, actor)
      .then(
        () => fail('retry must reject when its persisted proof key is absent'),
        (error) =>
          expectDomainError(
            error,
            ErrorCode.SHIFT_NOT_ACTIVE,
            'This shift was already clocked out with different proof or notes.',
          ),
      );
  });

  it.each([
    { keyId: 'unknown-key', version: 3 },
    { keyId: 'shift-current', version: 2 },
  ])('fails closed for an unknown key id or proof version', async (proofOverride) => {
    const { repository, service } = createService();
    repository.findShiftByIdForCarer.mockResolvedValue(shift());
    repository.closeShift.mockImplementation(
      async (_shiftId: string, _input: unknown, _carerId: string, _orgId: string, audit: any) => ({
        applied: false,
        shift: shift({ clock_out_at: new Date('2026-07-13T10:00:00.000Z') }),
        requestProof: requestProof(audit, proofOverride),
      }),
    );

    await service
      .clockOut(
        { shiftId: 'shift-1', method: ShiftVerificationMethod.MANUAL },
        carerId,
        'carer',
        organizationId,
        actor,
      )
      .then(
        () => fail('unknown proof configuration should reject'),
        (error) =>
          expectDomainError(
            error,
            ErrorCode.SHIFT_NOT_ACTIVE,
            'This shift was already clocked out with different proof or notes.',
          ),
      );
  });

  it('rejects retries from a different actor, membership, carer, or tenant', async () => {
    const { repository, service } = createService();
    const closed = shift({ clock_out_at: new Date('2026-07-13T10:00:00.000Z') });
    let originalProof: ReturnType<typeof requestProof> | null = null;
    repository.findShiftByIdForCarer.mockResolvedValue(closed);
    repository.closeShift.mockImplementation(
      async (_shiftId: string, _input: unknown, _carerId: string, _orgId: string, audit: any) => {
        originalProof ??= requestProof(audit);
        return {
          applied: false,
          shift: closed,
          requestProof: originalProof,
        };
      },
    );
    const request = {
      shiftId: 'shift-1',
      method: ShiftVerificationMethod.MANUAL,
      source: 'mobile',
      notes: 'Finished safely',
    };

    await service.clockOut(request, carerId, 'carer', organizationId, actor);
    await expect(
      service.clockOut(request, carerId, 'carer', organizationId, {
        ...actor,
        rawRole: 'staff',
        effectiveRole: 'staff',
      }),
    ).resolves.toBeDefined();
    expect(repository.closeShift.mock.calls[1][4].actorRole).toBe('carer');

    const variants = [
      {
        userId: carerId,
        organizationId,
        access: { ...actor, authSubject: 'subject-2' },
      },
      {
        userId: carerId,
        organizationId,
        access: { ...actor, membershipId: 'membership-2' },
      },
      {
        userId: 'carer-2',
        organizationId,
        access: { ...actor, domainIdentityId: 'carer-2' },
      },
      {
        userId: carerId,
        organizationId: 'org-2',
        access: { ...actor, organizationId: 'org-2' },
      },
    ];

    for (const variant of variants) {
      await service
        .clockOut(
          request,
          variant.userId,
          'carer',
          variant.organizationId,
          variant.access,
        )
        .then(
          () => fail('identity-changing retry should reject'),
          (error) =>
            expectDomainError(
              error,
              ErrorCode.SHIFT_NOT_ACTIVE,
              'This shift was already clocked out with different proof or notes.',
            ),
        );
    }

    const fingerprints = repository.closeShift.mock.calls.map(
      (call: any[]) => call[4].requestFingerprint,
    );
    expect(new Set(fingerprints).size).toBe(variants.length + 1);
  });

  it('accepts an identical loser after the conditional close update', async () => {
    const { repository, service } = createService();
    const active = shift();
    const firstClose = shift({
      clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
      clock_out_method: ShiftVerificationMethod.MANUAL,
      clock_out_source: 'mobile',
      notes: 'Finished safely',
    });
    repository.findShiftByIdForCarer.mockResolvedValue(active);
    repository.closeShift.mockResolvedValue({
      applied: false,
      shift: firstClose,
      requestProof: null,
    });
    repository.closeShift.mockImplementation(
      async (_shiftId: string, _input: unknown, _carerId: string, _orgId: string, audit: any) => ({
        applied: false,
        shift: firstClose,
        requestProof: requestProof(audit),
      }),
    );

    const result = await service.clockOut(
      {
        shiftId: 'shift-1',
        method: ShiftVerificationMethod.MANUAL,
        source: 'mobile',
        notes: 'Finished safely',
      },
      carerId,
      'carer',
      organizationId,
      actor,
    );

    expect(result.clockOutAt).toEqual(firstClose.clock_out_at);
  });

  it('rejects an omitted-note retry after an explicit-note close', async () => {
    const { repository, service } = createService();
    const active = shift();
    const firstClose = shift({
      clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
      clock_out_method: ShiftVerificationMethod.MANUAL,
      clock_out_source: 'mobile',
      notes: 'Finished safely',
    });
    let originalProof: ReturnType<typeof requestProof> | null = null;
    repository.findShiftByIdForCarer
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(firstClose);
    repository.closeShift.mockImplementation(
      async (_shiftId: string, _input: unknown, _carerId: string, _orgId: string, audit: any) => {
        originalProof ??= requestProof(audit);
        return {
          applied: originalProof.hmac === audit.requestFingerprint,
          shift: firstClose,
          requestProof: originalProof,
        };
      },
    );

    await service.clockOut(
      {
        shiftId: 'shift-1',
        method: ShiftVerificationMethod.MANUAL,
        source: 'mobile',
        notes: 'Finished safely',
      },
      carerId,
      'carer',
      organizationId,
      actor,
    );

    await service
      .clockOut(
        {
          shiftId: 'shift-1',
          method: ShiftVerificationMethod.MANUAL,
          source: 'mobile',
        },
        carerId,
        'carer',
        organizationId,
        actor,
      )
      .then(
        () => fail('omitted-note retry should reject'),
        (error) =>
          expectDomainError(
            error,
            ErrorCode.SHIFT_NOT_ACTIVE,
            'This shift was already clocked out with different proof or notes.',
          ),
      );

    expect(repository.closeShift.mock.calls[0][4].notesProvided).toBe(true);
    expect(repository.closeShift.mock.calls[1][4].notesProvided).toBe(false);
    expect(repository.closeShift.mock.calls[0][4].requestFingerprint).not.toBe(
      repository.closeShift.mock.calls[1][4].requestFingerprint,
    );
  });

  it('rejects an omitted-note request that loses a concurrent explicit-note close', async () => {
    const { repository, service } = createService();
    const firstClose = shift({
      clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
      clock_out_method: ShiftVerificationMethod.MANUAL,
      clock_out_source: 'mobile',
      notes: 'Concurrent winner',
    });
    repository.findShiftByIdForCarer.mockResolvedValue(shift());
    repository.closeShift.mockResolvedValue({
      applied: false,
      shift: firstClose,
      requestProof: {
        hmac: 'f'.repeat(64),
        keyId: 'shift-current',
        version: 3,
      },
    });

    await service
      .clockOut(
        {
          shiftId: 'shift-1',
          method: ShiftVerificationMethod.MANUAL,
          source: 'mobile',
        },
        carerId,
        'carer',
        organizationId,
        actor,
      )
      .then(
        () => fail('losing omitted-note clock-out should reject'),
        (error) =>
          expectDomainError(
            error,
            ErrorCode.SHIFT_NOT_ACTIVE,
            'This shift was already clocked out with different proof or notes.',
          ),
      );

    expect(repository.closeShift.mock.calls[0][4]).toEqual(
      expect.objectContaining({ notesProvided: false }),
    );
  });

  it('rejects a foreign or missing exact shift without attempting a close', async () => {
    const { repository, service } = createService();
    repository.findShiftByIdForCarer.mockResolvedValue(null);

    await service
      .clockOut(
        {
          shiftId: 'missing-shift',
          method: ShiftVerificationMethod.MANUAL,
          source: 'mobile',
        },
        carerId,
        'carer',
        organizationId,
        actor,
      )
      .then(
        () => fail('clock-out should reject'),
        (error) =>
          expectDomainError(
            error,
            ErrorCode.SHIFT_NOT_ACTIVE,
            'The requested shift is unavailable for this account.',
          ),
      );

    expect(repository.findShiftByIdForCarer).toHaveBeenCalledWith(
      'missing-shift',
      carerId,
      organizationId,
    );
    expect(repository.closeShift).not.toHaveBeenCalled();
  });
});
