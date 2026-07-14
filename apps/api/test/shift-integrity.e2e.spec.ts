import { PrismaService, ShiftVerificationMethod } from '@oasis/db';
import { StartedTestContainer } from 'testcontainers';
import type { CanonicalCapabilityActor } from '../src/auth/access-capability';
import { BaseHttpException } from '../src/common/errors/base-http.exception';
import { ErrorCode } from '../src/common/errors/error-codes';
import { ShiftRepository } from '../src/shift/shift.repository';
import { ShiftService } from '../src/shift/shift.service';
import { startPostgres } from './utils/test-container';

describe('Shift integrity database integration', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalCurrentKeyId = process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID;
  const originalCurrentSecret = process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET;
  const originalPreviousKeys = process.env.SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON;
  let container: StartedTestContainer;
  let prisma: PrismaService;
  let secondPrisma: PrismaService;
  let repository: ShiftRepository;
  let secondRepository: ShiftRepository;
  let service: ShiftService;
  let secondService: ShiftService;

  const organizationId = 'org-shift-integrity';
  const carerId = 'carer-shift-integrity';
  const actor: CanonicalCapabilityActor = {
    authenticated: true,
    authSubject: 'subject-shift-integrity',
    identityProvider: 'clerk',
    organizationId,
    membershipId: 'membership-shift-integrity',
    membershipState: 'ACTIVE',
    rawRole: 'carer',
    effectiveRole: 'carer',
    surface: 'STAFF',
    linkedIdentityState: 'LINKED',
    onboardingState: 'READY',
    domainIdentityId: carerId,
  };

  beforeAll(async () => {
    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID = 'shift-integration';
    process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET = Buffer.alloc(32, 3).toString('base64');
    process.env.SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON = '[]';
    const started = await startPostgres();
    container = started.container;
    process.env.DATABASE_URL = started.dbUrl;
    process.env.NODE_ENV = 'test';
    prisma = new PrismaService();
    secondPrisma = new PrismaService();
    await prisma.$connect();
    await secondPrisma.$connect();
  }, 180000);

  afterAll(async () => {
    await secondPrisma?.$disconnect();
    await prisma?.$disconnect();
    await container?.stop();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalCurrentKeyId === undefined) {
      delete process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID;
    }
    else process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID = originalCurrentKeyId;
    if (originalCurrentSecret === undefined) {
      delete process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET;
    }
    else process.env.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET = originalCurrentSecret;
    if (originalPreviousKeys === undefined) {
      delete process.env.SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON;
    }
    else process.env.SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON = originalPreviousKeys;
  });

  beforeEach(async () => {
    repository = new ShiftRepository(prisma);
    secondRepository = new ShiftRepository(secondPrisma);
    service = new ShiftService(repository);
    secondService = new ShiftService(secondRepository);
    await prisma.auditLog.deleteMany({ where: { organization_id: organizationId } });
    await prisma.carerShift.deleteMany();
    await prisma.carer.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.organization.create({
      data: { id: organizationId, name: 'Shift Integrity Test' },
    });
    await prisma.carer.create({
      data: {
        id: carerId,
        organization_id: organizationId,
        first_name: 'Amira',
        last_name: 'Khan',
        email: 'amira.shift-integrity@example.test',
        is_active: true,
      },
    });
  });

  function clockIn(target = service) {
    return target.clockIn(
      {
        method: ShiftVerificationMethod.MANUAL,
        source: 'integration-test',
        notes: 'Shift started',
      },
      carerId,
      'carer',
      organizationId,
      actor,
    );
  }

  function clockOut(input: {
    shiftId: string;
    method: ShiftVerificationMethod;
    source: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
  }, target = service) {
    return target.clockOut(input, carerId, 'carer', organizationId, actor);
  }

  function boundedBarrier(parties: number, timeoutMs = 5_000) {
    let arrivals = 0;
    let release!: () => void;
    let reject!: (error: Error) => void;
    const gate = new Promise<void>((resolve, rejectGate) => {
      release = resolve;
      reject = rejectGate;
    });
    const timeout = setTimeout(() => {
      reject(new Error(`Concurrency barrier timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timeout.unref?.();

    return async () => {
      arrivals += 1;
      if (arrivals === parties) {
        clearTimeout(timeout);
        release();
      }
      await gate;
    };
  }

  function gateRepositoryMethod(methodName: 'createShift' | 'closeShift') {
    const wait = boundedBarrier(2);
    for (const target of [repository, secondRepository]) {
      const original = target[methodName].bind(target) as (...args: any[]) => Promise<unknown>;
      (target as any)[methodName] = async (...args: any[]) => {
        await wait();
        return original(...args);
      };
    }
  }

  async function expectOneClockOutAudit(shiftId: string) {
    await expect(
      prisma.auditLog.count({
        where: {
          organization_id: organizationId,
          action: 'SHIFT_CLOCKED_OUT',
          resource_id: shiftId,
        },
      }),
    ).resolves.toBe(1);
  }

  function outcome<T>(promise: Promise<T>) {
    return promise.then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason }),
    );
  }

  function expectDomainError(reason: unknown, code: ErrorCode, message?: string) {
    expect(reason).toBeInstanceOf(BaseHttpException);
    const response = (reason as BaseHttpException).getResponse();
    expect(response).toEqual(message ? { code, message } : expect.objectContaining({ code }));
  }

  it('retains the existing partial unique open-shift index', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'carer_shift_one_open_per_carer_idx'
    `;

    expect(indexes).toHaveLength(1);
    expect(indexes[0].indexdef).toContain('UNIQUE INDEX');
    expect(indexes[0].indexdef).toContain('clock_out_at IS NULL');
    expect(indexes[0].indexdef).toContain('deleted_at IS NULL');
  });

  it('allows one concurrent clock-in and maps the index loser to SHIFT_ALREADY_ACTIVE', async () => {
    gateRepositoryMethod('createShift');
    const attempts = await Promise.all([
      outcome(clockIn(service)),
      outcome(clockIn(secondService)),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectedAttempt = attempts.find((attempt) => attempt.status === 'rejected');
    if (rejectedAttempt?.status !== 'rejected') {
      throw new Error('Expected one clock-in rejection');
    }
    expectDomainError(rejectedAttempt.reason, ErrorCode.SHIFT_ALREADY_ACTIVE);
    await expect(
      prisma.carerShift.count({
        where: { carer_id: carerId, clock_out_at: null, deleted_at: null },
      }),
    ).resolves.toBe(1);
  });

  it('makes concurrent identical clock-out retries return the first close record', async () => {
    const opened = await clockIn();
    const request = {
      shiftId: opened.id,
      method: ShiftVerificationMethod.GPS,
      source: 'mobile',
      notes: 'Shift finished safely',
      latitude: 51.501,
      longitude: -0.141,
    };

    gateRepositoryMethod('closeShift');
    const [first, retry] = await Promise.all([
      clockOut(request, service),
      clockOut(request, secondService),
    ]);
    expect(first.id).toBe(retry.id);
    expect(first.clockOutAt).toEqual(retry.clockOutAt);
    expect(first.clockOutProof).toEqual(retry.clockOutProof);
    expect(first.notes).toBe('Shift finished safely');

    const persisted = await prisma.carerShift.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(persisted.clock_out_at).toEqual(first.clockOutAt);
    expect(persisted.clock_out_method).toBe(ShiftVerificationMethod.GPS);
    expect(persisted.clock_out_source).toBe('mobile');
    expect(persisted.notes).toBe('Shift finished safely');

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        organization_id: organizationId,
        action: 'SHIFT_CLOCKED_OUT',
        resource_id: first.id,
      },
    });
    expect(audit.user_id).toBe(actor.authSubject);
    expect(audit.new_values).toEqual(
      expect.objectContaining({
        membershipId: actor.membershipId,
        notesProvided: true,
        fingerprintKeyId: 'shift-integration',
        fingerprintVersion: 3,
        requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(JSON.stringify(audit.new_values)).not.toContain('Shift finished safely');
    await expectOneClockOutAudit(first.id);
  });

  it('rejects an omitted-note retry without inheriting the closed row note', async () => {
    const opened = await clockIn();
    const explicit = {
      shiftId: opened.id,
      method: ShiftVerificationMethod.MANUAL,
      source: 'mobile',
      notes: 'Explicit close note',
    };

    const first = await clockOut(explicit);
    await expect(
      clockOut({
        shiftId: opened.id,
        method: ShiftVerificationMethod.MANUAL,
        source: 'mobile',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.SHIFT_NOT_ACTIVE,
        message: 'This shift was already clocked out with different proof or notes.',
      },
    });

    const persisted = await prisma.carerShift.findUniqueOrThrow({ where: { id: opened.id } });
    expect(persisted.clock_out_at).toEqual(first.clockOutAt);
    expect(persisted.notes).toBe('Explicit close note');
  });

  it('makes explicit-note and omitted-note concurrent closes request-exact', async () => {
    const opened = await clockIn();
    const explicit = {
      shiftId: opened.id,
      method: ShiftVerificationMethod.MANUAL,
      source: 'mobile',
      notes: 'Explicit concurrent close',
    };
    const omitted = {
      shiftId: opened.id,
      method: ShiftVerificationMethod.MANUAL,
      source: 'mobile',
    };

    gateRepositoryMethod('closeShift');
    const attempts = await Promise.all([
      outcome(clockOut(explicit, service)),
      outcome(clockOut(omitted, secondService)),
    ]);
    const fulfilled = attempts.find((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.find((attempt) => attempt.status === 'rejected');
    if (fulfilled?.status !== 'fulfilled' || rejected?.status !== 'rejected') {
      throw new Error('Expected one request-exact clock-out winner and one conflict');
    }
    expectDomainError(
      rejected.reason,
      ErrorCode.SHIFT_NOT_ACTIVE,
      'This shift was already clocked out with different proof or notes.',
    );

    const explicitWon = fulfilled.value.notes === explicit.notes;
    const winnerInput = explicitWon ? explicit : omitted;
    const loserInput = explicitWon ? omitted : explicit;
    const retry = await clockOut(winnerInput);
    expect(retry.clockOutAt).toEqual(fulfilled.value.clockOutAt);
    await expect(clockOut(loserInput)).rejects.toMatchObject({
      response: {
        code: ErrorCode.SHIFT_NOT_ACTIVE,
        message: 'This shift was already clocked out with different proof or notes.',
      },
    });

    const persisted = await prisma.carerShift.findUniqueOrThrow({ where: { id: opened.id } });
    expect(persisted.clock_out_at).toEqual(fulfilled.value.clockOutAt);
    expect(persisted.notes).toBe(explicitWon ? explicit.notes : 'Shift started');
    await expectOneClockOutAudit(opened.id);
  });

  it('allows one conflicting clock-out, rejects the other, and never overwrites the winner', async () => {
    const opened = await clockIn();
    const mobileClose = {
      shiftId: opened.id,
      method: ShiftVerificationMethod.GPS,
      source: 'mobile',
      notes: 'Mobile close',
      latitude: 51.501,
      longitude: -0.141,
    };
    const manualClose = {
      shiftId: opened.id,
      method: ShiftVerificationMethod.MANUAL,
      source: 'office',
      notes: 'Manual close',
    };

    gateRepositoryMethod('closeShift');
    const attempts = await Promise.all([
      outcome(clockOut(mobileClose, service)),
      outcome(clockOut(manualClose, secondService)),
    ]);
    const fulfilled = attempts.find((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.find((attempt) => attempt.status === 'rejected');

    expect(fulfilled?.status).toBe('fulfilled');
    expect(rejected?.status).toBe('rejected');
    if (fulfilled?.status !== 'fulfilled' || rejected?.status !== 'rejected') {
      throw new Error('Expected one clock-out winner and one conflict');
    }
    expectDomainError(
      rejected.reason,
      ErrorCode.SHIFT_NOT_ACTIVE,
      'This shift was already clocked out with different proof or notes.',
    );

    const winner = fulfilled.value;
    const winnerInput = winner.clockOutProof?.source === 'mobile' ? mobileClose : manualClose;
    const loserInput = winnerInput === mobileClose ? manualClose : mobileClose;
    const firstPersisted = await prisma.carerShift.findUniqueOrThrow({
      where: { id: winner.id },
    });

    const retry = await clockOut(winnerInput);
    expect(retry.clockOutAt).toEqual(firstPersisted.clock_out_at);
    await expect(clockOut(loserInput)).rejects.toMatchObject({
      response: {
        code: ErrorCode.SHIFT_NOT_ACTIVE,
        message: 'This shift was already clocked out with different proof or notes.',
      },
    });

    const afterRetries = await prisma.carerShift.findUniqueOrThrow({
      where: { id: winner.id },
    });
    expect(afterRetries.clock_out_at).toEqual(firstPersisted.clock_out_at);
    expect(afterRetries.clock_out_method).toBe(firstPersisted.clock_out_method);
    expect(afterRetries.clock_out_lat).toBe(firstPersisted.clock_out_lat);
    expect(afterRetries.clock_out_lng).toBe(firstPersisted.clock_out_lng);
    expect(afterRetries.clock_out_source).toBe(firstPersisted.clock_out_source);
    expect(afterRetries.notes).toBe(firstPersisted.notes);
    await expectOneClockOutAudit(opened.id);
  });

  it('scopes missing and foreign shift IDs without changing any shift', async () => {
    const opened = await clockIn();
    const otherCarer = await prisma.carer.create({
      data: {
        id: 'other-carer-shift-integrity',
        organization_id: organizationId,
        first_name: 'Other',
        last_name: 'Carer',
        email: 'other.shift-integrity@example.test',
        is_active: true,
      },
    });
    const foreignShift = await prisma.carerShift.create({
      data: {
        organization_id: organizationId,
        carer_id: otherCarer.id,
        clock_in_at: new Date(),
        clock_in_method: ShiftVerificationMethod.MANUAL,
        clock_in_source: 'integration-test',
      },
    });
    const request = {
      method: ShiftVerificationMethod.MANUAL,
      source: 'mobile',
      notes: 'Must not be written',
    };

    for (const shiftId of ['00000000-0000-4000-8000-000000000099', foreignShift.id]) {
      await expect(clockOut({ shiftId, ...request })).rejects.toMatchObject({
        response: {
          code: ErrorCode.SHIFT_NOT_ACTIVE,
          message: 'The requested shift is unavailable for this account.',
        },
      });
    }

    const [ownPersisted, foreignPersisted] = await Promise.all([
      prisma.carerShift.findUniqueOrThrow({ where: { id: opened.id } }),
      prisma.carerShift.findUniqueOrThrow({ where: { id: foreignShift.id } }),
    ]);
    expect(ownPersisted.clock_out_at).toBeNull();
    expect(foreignPersisted.clock_out_at).toBeNull();
  });

  it('returns an exact late retry without closing a newer active shift', async () => {
    const first = await clockIn();
    const firstRequest = {
      shiftId: first.id,
      method: ShiftVerificationMethod.GPS,
      source: 'mobile',
      notes: 'First shift safely closed',
      latitude: 51.501,
      longitude: -0.141,
    };
    const firstClose = await clockOut(firstRequest);
    const newer = await clockIn();

    const lateRetry = await clockOut(firstRequest);
    expect(lateRetry.id).toBe(first.id);
    expect(lateRetry.clockOutAt).toEqual(firstClose.clockOutAt);
    await expect(
      clockOut({
        ...firstRequest,
        notes: 'Conflicting late retry',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.SHIFT_NOT_ACTIVE,
        message: 'This shift was already clocked out with different proof or notes.',
      },
    });

    const [firstPersisted, newerPersisted] = await Promise.all([
      prisma.carerShift.findUniqueOrThrow({ where: { id: first.id } }),
      prisma.carerShift.findUniqueOrThrow({ where: { id: newer.id } }),
    ]);
    expect(firstPersisted.clock_out_at).toEqual(firstClose.clockOutAt);
    expect(firstPersisted.notes).toBe('First shift safely closed');
    expect(newerPersisted.clock_out_at).toBeNull();
    expect(newerPersisted.clock_out_method).toBeNull();
    expect(newerPersisted.notes).toBe('Shift started');
  });

  it('rolls back the shift close when the transactional audit insert fails', async () => {
    const opened = await clockIn();
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_shift_clock_out_audit()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.action = 'SHIFT_CLOCKED_OUT' THEN
          RAISE EXCEPTION 'synthetic shift audit insert failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER reject_shift_clock_out_audit_trigger
      BEFORE INSERT ON audit_log
      FOR EACH ROW EXECUTE FUNCTION reject_shift_clock_out_audit()
    `);

    try {
      await expect(
        clockOut({
          shiftId: opened.id,
          method: ShiftVerificationMethod.MANUAL,
          source: 'integration-test',
          notes: 'Must roll back with audit failure',
        }),
      ).rejects.toBeDefined();
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS reject_shift_clock_out_audit_trigger ON audit_log',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_shift_clock_out_audit()');
    }

    const persisted = await prisma.carerShift.findUniqueOrThrow({
      where: { id: opened.id },
    });
    expect(persisted.clock_out_at).toBeNull();
    expect(persisted.clock_out_method).toBeNull();
    expect(persisted.clock_out_source).toBeNull();
    expect(persisted.notes).toBe('Shift started');
    await expect(
      prisma.auditLog.count({
        where: {
          organization_id: organizationId,
          action: 'SHIFT_CLOCKED_OUT',
          resource_id: opened.id,
        },
      }),
    ).resolves.toBe(0);
  });
});
