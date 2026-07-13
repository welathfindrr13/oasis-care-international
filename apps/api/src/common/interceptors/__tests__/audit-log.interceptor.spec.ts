import { AuditLogInterceptor } from '../audit-log.interceptor';
import { GqlExecutionContext } from '@nestjs/graphql';
import { HttpStatus } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { of, lastValueFrom, throwError } from 'rxjs';
import { BaseHttpException } from '../../errors/base-http.exception';
import { ErrorCode } from '../../errors/error-codes';

describe('AuditLogInterceptor', () => {
  const flushAuditWrite = () => new Promise((resolve) => setImmediate(resolve));
  const validIds = {
    resource: '00000000-0000-4000-8000-000000000001',
    client: '00000000-0000-4000-8000-000000000002',
    administration: '00000000-0000-4000-8000-000000000003',
    visit: '00000000-0000-4000-8000-000000000004',
  };

  const identifierFields: ReadonlyArray<readonly [string, string]> = [
    ['id', 'id'],
    ['accessGrantId', 'accessGrantId'],
    ['actorId', 'actorId'],
    ['assessmentId', 'assessmentId'],
    ['carePlanId', 'carePlanId'],
    ['carerId', 'carerId'],
    ['careRoomId', 'careRoomId'],
    ['clientId', 'clientId'],
    ['evidenceItemId', 'evidenceItemId'],
    ['evidencePackId', 'evidencePackId'],
    ['familyContactId', 'familyContactId'],
    ['invitationId', 'invitationId'],
    ['membershipId', 'membershipId'],
    ['organizationId', 'organizationId'],
    ['organizationMembershipId', 'organizationMembershipId'],
    ['requestId', 'requestId'],
    ['shiftId', 'shiftId'],
    ['sourceRequestId', 'sourceRequestId'],
    ['storyId', 'storyId'],
    ['taskId', 'taskId'],
    ['userId', 'userId'],
    ['verifiedVisitStoryId', 'verifiedVisitStoryId'],
    ['visitId', 'visitId'],
    ['visitTaskId', 'visitTaskId'],
  ];

  function createInterceptor() {
    const prisma = {
      auditLog: {
        create: jest.fn(),
      },
    };

    return {
      interceptor: new AuditLogInterceptor(prisma as any),
      prisma,
    };
  }

  const baseEntry = {
    userId: 'user_test_123',
    action: 'GraphQL Query.careRooms [SUCCESS 12ms]',
    resourceType: 'Query',
    organizationId: 'org-internal-1',
    ipAddress: '203.0.113.10',
    userAgent: 'Jest',
  };

  it('writes audit logs with a valid internal organization id', async () => {
    const { interceptor, prisma } = createInterceptor();
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' });

    await (interceptor as any).logToDatabase(baseEntry);

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'user_test_123',
        organization_id: 'org-internal-1',
        action: 'GraphQL Query.careRooms [SUCCESS 12ms]',
        resource_type: 'Query',
      }),
    });
  });

  it('degrades audit logging to nullable organization id when organization FK is stale', async () => {
    const { interceptor, prisma } = createInterceptor();
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fkFailure = Object.assign(
      new Error('Foreign key constraint failed'),
      {
        code: 'P2003',
        meta: {
          modelName: 'AuditLog',
          field_name: 'audit_log_organization_id_fkey (index)',
        },
      },
    );

    prisma.auditLog.create
      .mockRejectedValueOnce(fkFailure)
      .mockResolvedValueOnce({ id: 'audit-2' });

    await expect(
      (interceptor as any).logToDatabase(baseEntry),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        organization_id: 'org-internal-1',
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        organization_id: null,
      }),
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Audit log organization FK failed; retrying without organization_id',
      expect.objectContaining({
        code: 'P2003',
        modelName: 'AuditLog',
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('degrades audit logging for Prisma target-array organization FK metadata', async () => {
    const { interceptor, prisma } = createInterceptor();
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const fkFailure = Object.assign(
      new Error('Foreign key constraint failed'),
      {
        code: 'P2003',
        meta: {
          modelName: 'AuditLog',
          target: ['organization_id'],
        },
      },
    );

    prisma.auditLog.create
      .mockRejectedValueOnce(fkFailure)
      .mockResolvedValueOnce({ id: 'audit-3' });

    await expect(
      (interceptor as any).logToDatabase(baseEntry),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        organization_id: null,
      }),
    });

    warnSpy.mockRestore();
  });

  it('does not retry generic audit log write errors', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    prisma.auditLog.create.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(
      (interceptor as any).logToDatabase(baseEntry),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to write audit log:',
      expect.objectContaining({
        name: 'Error',
      }),
    );

    errorSpy.mockRestore();
  });

  it('does not retry P2003 errors for a different model', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fkFailure = Object.assign(
      new Error('Foreign key constraint failed'),
      {
        code: 'P2003',
        meta: {
          modelName: 'CareLog',
          field_name: 'care_log_organization_id_fkey (index)',
        },
      },
    );

    prisma.auditLog.create.mockRejectedValueOnce(fkFailure);

    await expect(
      (interceptor as any).logToDatabase(baseEntry),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('does not retry P2003 errors without organization FK metadata', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fkFailure = Object.assign(
      new Error('Foreign key constraint failed'),
      {
        code: 'P2003',
        meta: {
          modelName: 'AuditLog',
          field_name: 'audit_log_user_id_fkey (index)',
        },
      },
    );

    prisma.auditLog.create.mockRejectedValueOnce(fkFailure);

    await expect(
      (interceptor as any).logToDatabase(baseEntry),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('does not retry when organization id is already nullable', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fkFailure = Object.assign(
      new Error('Foreign key constraint failed'),
      {
        code: 'P2003',
        meta: {
          modelName: 'AuditLog',
          field_name: 'audit_log_organization_id_fkey (index)',
        },
      },
    );

    prisma.auditLog.create.mockRejectedValueOnce(fkFailure);

    await expect(
      (interceptor as any).logToDatabase({
        ...baseEntry,
        organizationId: null,
      }),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('catches and logs retry failures without throwing into the request path', async () => {
    const { interceptor, prisma } = createInterceptor();
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fkFailure = Object.assign(
      new Error('Foreign key constraint failed'),
      {
        code: 'P2003',
        meta: {
          modelName: 'AuditLog',
          field_name: 'audit_log_organization_id_fkey (index)',
        },
      },
    );
    const retryFailure = new Error('retry failed');

    prisma.auditLog.create
      .mockRejectedValueOnce(fkFailure)
      .mockRejectedValueOnce(retryFailure);

    await expect(
      (interceptor as any).logToDatabase(baseEntry),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to write audit log:',
      expect.objectContaining({
        name: 'Error',
      }),
    );

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('does not let audit write failures change the HTTP response observable', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    prisma.auditLog.create.mockRejectedValueOnce(
      new Error('audit sink unavailable'),
    );

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/test',
          user: {
            id: 'user_test_123',
            organizationId: 'org-internal-1',
          },
          ip: '203.0.113.10',
          headers: {
            'user-agent': 'Jest',
          },
        }),
      }),
    };
    const next = {
      handle: () => of({ ok: true }),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next as any)),
    ).resolves.toEqual({ ok: true });

    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to write audit log:',
      expect.objectContaining({
        name: 'Error',
      }),
    );

    errorSpy.mockRestore();
  });

  it('persists only reviewed HTTP identifiers and workflow metadata from hostile nested bodies', async () => {
    const { interceptor, prisma } = createInterceptor();
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-http-safe' });
    const forbidden = [
      'HTTP_QUERY_PRIVATE_NOTE',
      'HEADER_PRIVATE_NOTE',
      'PERSON_PRIVATE_CLINICAL_TEXT',
      'MEDICATION_PRIVATE_TEXT',
      'SAFEGUARDING_PRIVATE_TEXT',
      'sk_live_forbidden_value',
    ];
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: `/visits/${validIds.resource}?note=${forbidden[0]}`,
          user: { id: 'user-http-1', organizationId: 'org-http-1' },
          ip: '203.0.113.20',
          headers: { 'user-agent': forbidden[1] },
          body: {
            id: validIds.visit,
            clientId: validIds.client,
            status: 'IN_PROGRESS',
            scopes: [
              'VIEW_UPDATES',
              'VIEW_MEDICATION_SUPPORT_STATUS',
              'RAISE_CONCERNS',
            ],
            outcome: 'ESCALATED',
            reason: 'APPROVED',
            timestamp: 'ACTIVE',
            freeText: forbidden[2],
            apiKey: forbidden[5],
            medication: { id: 'medication-1', dosage: forbidden[3] },
            safeguardingConcern: { id: 'concern-1', note: forbidden[4] },
            nested: [{ message: forbidden[2], password: forbidden[5] }],
          },
        }),
      }),
    };

    await expect(
      lastValueFrom(
        interceptor.intercept(
          context as any,
          { handle: () => of({ ok: true }) } as any,
        ),
      ),
    ).resolves.toEqual({ ok: true });
    await flushAuditWrite();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'user-http-1',
        organization_id: 'org-http-1',
        action: expect.stringMatching(/^HTTP POST visits \[SUCCESS \d+ms\]$/),
        resource_type: 'visits',
        resource_id: validIds.resource,
        ip_address: '203.0.113.20',
        new_values: {
          id: validIds.visit,
          clientId: validIds.client,
          status: 'IN_PROGRESS',
          scopes: ['VIEW_UPDATES'],
        },
      }),
    });
    const persisted = JSON.stringify(prisma.auditLog.create.mock.calls);
    for (const value of forbidden) expect(persisted).not.toContain(value);
    expect(persisted).not.toContain('medication-1');
    expect(persisted).not.toContain('concern-1');
    expect(persisted).not.toContain('user_agent');
  });

  it('rejects secret and clinical-shaped values from every request-controlled identifier sink', async () => {
    const { interceptor, prisma } = createInterceptor();
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-hostile-ids' });
    const hostileIdentifiers = Object.fromEntries(
      identifierFields.map(([inputField], index) => [
        inputField,
        index % 2 === 0
          ? `sk_live_${inputField}_SECRET`
          : `clinical-diagnosis-${inputField}`,
      ]),
    );
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/visits/sk_live_RESOURCE_SECRET?note=clinical-diagnosis',
          user: { id: 'user-http-1', organizationId: 'org-http-1' },
          headers: {},
          body: hostileIdentifiers,
        }),
      }),
    };

    await lastValueFrom(
      interceptor.intercept(
        context as any,
        { handle: () => of({ ok: true }) } as any,
      ),
    );
    await flushAuditWrite();

    const data = prisma.auditLog.create.mock.calls[0][0].data;
    expect(data.resource_id).toBeUndefined();
    expect(data.new_values).toEqual({});
    expect(
      (interceptor as any).extractGraphqlResourceId({
        id: 'clinical-diagnosis-graphql',
        input: { id: 'sk_live_GRAPHQL_SECRET' },
      }),
    ).toBeUndefined();
    expect(
      (interceptor as any).createAuditLogData({
        ...baseEntry,
        resourceId: 'clinical-diagnosis-resource',
      }).resource_id,
    ).toBeUndefined();

    const persisted = JSON.stringify(prisma.auditLog.create.mock.calls);
    for (const hostileValue of Object.values(hostileIdentifiers)) {
      expect(persisted).not.toContain(hostileValue);
    }
    expect(persisted).not.toContain('sk_live_RESOURCE_SECRET');
    expect(persisted).not.toContain('clinical-diagnosis');
  });

  it('preserves UUID values across every reviewed identifier metadata field', () => {
    const { interceptor } = createInterceptor();
    const payload: Record<string, string> = {};
    const expected: Record<string, string> = {};

    identifierFields.forEach(([inputField, outputField], index) => {
      const uuid = `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`;
      payload[inputField] = uuid;
      expected[outputField] = uuid;
    });

    expect((interceptor as any).extractAllowedMetadata(payload)).toEqual(
      expected,
    );
    expect(
      (interceptor as any).createAuditLogData({
        ...baseEntry,
        resourceId: validIds.resource,
      }),
    ).toEqual(
      expect.objectContaining({
        user_id: baseEntry.userId,
        organization_id: baseEntry.organizationId,
        resource_id: validIds.resource,
      }),
    );
  });

  it('uses distinct code-owned GDPR route templates without raw path or query values', async () => {
    const cases = [
      ['POST', 'consent', '/gdpr/consent', 'Gdpr/consent'],
      ['POST', 'sar', '/gdpr/sar', 'Gdpr/sar'],
      ['POST', 'erasure', '/gdpr/erasure', 'Gdpr/erasure'],
      [
        'GET',
        'consent/:userId',
        '/gdpr/consent/PATIENT_PRIVATE_STATUS',
        'Gdpr/consent/:id',
      ],
      [
        'GET',
        'consent/:userId/history',
        '/gdpr/consent/PATIENT_PRIVATE_HISTORY/history',
        'Gdpr/consent/:id/history',
      ],
      [
        'GET',
        'consent/:userId/check',
        '/gdpr/consent/PATIENT_PRIVATE_CHECK/check?type=SECRET_QUERY',
        'Gdpr/consent/:id/check',
      ],
    ] as const;
    const actions: string[] = [];

    for (const [method, routePath, url, expectedIdentity] of cases) {
      const { interceptor, prisma } = createInterceptor();
      prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-gdpr-action' });
      const context = {
        getType: () => 'http',
        getClass: () => class GdprController {},
        getHandler: () => function registeredHandler() {},
        switchToHttp: () => ({
          getRequest: () => ({
            method,
            url,
            route: { path: routePath },
            user: { id: 'user-gdpr-1', organizationId: 'org-gdpr-1' },
            headers: {},
          }),
        }),
      };

      await lastValueFrom(
        interceptor.intercept(
          context as any,
          { handle: () => of({ ok: true }) } as any,
        ),
      );
      await flushAuditWrite();

      const action = prisma.auditLog.create.mock.calls[0][0].data.action;
      expect(action).toMatch(
        new RegExp(`^HTTP ${method} ${expectedIdentity.replace(/\//g, '\\/')}`),
      );
      expect(action).not.toContain('PATIENT_PRIVATE');
      expect(action).not.toContain('SECRET_QUERY');
      actions.push(action.replace(/ \[(?:SUCCESS|ERROR).*$/, ''));
    }

    expect(new Set(actions)).toHaveProperty('size', cases.length);
  });

  it('keeps GraphQL resource identity but drops all medication-domain argument metadata', async () => {
    const { interceptor, prisma } = createInterceptor();
    prisma.auditLog.create.mockResolvedValueOnce({
      id: 'audit-graphql-medication',
    });
    const forbidden = 'GRAPHQL_MEDICATION_PRIVATE_TEXT';
    const gqlSpy = jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: {
          user: { sub: 'user-graphql-1', organizationId: 'org-graphql-1' },
          ip: '2001:db8::1',
          headers: { 'user-agent': forbidden },
        },
      }),
      getInfo: () => ({
        parentType: { name: 'Mutation' },
        fieldName: 'recordMedication',
      }),
      getArgs: () => ({
        input: {
          id: validIds.administration,
          visitId: validIds.visit,
          status: 'COMPLETED',
          notes: forbidden,
          secret: 'sk_forbidden_graphql',
        },
      }),
    } as any);

    const context = { getType: () => 'graphql' };
    await expect(
      lastValueFrom(
        interceptor.intercept(
          context as any,
          { handle: () => of({ ok: true }) } as any,
        ),
      ),
    ).resolves.toEqual({ ok: true });
    await flushAuditWrite();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'user-graphql-1',
        organization_id: 'org-graphql-1',
        action: expect.stringMatching(
          /^GraphQL Mutation\.recordMedication \[SUCCESS \d+ms\]$/,
        ),
        resource_type: 'Mutation',
        resource_id: validIds.administration,
        new_values: {},
        ip_address: '2001:db8::1',
      }),
    });
    const persisted = JSON.stringify(prisma.auditLog.create.mock.calls);
    expect(persisted).not.toContain(forbidden);
    expect(persisted).not.toContain('sk_forbidden_graphql');
    expect(persisted).not.toContain(validIds.visit);
    gqlSpy.mockRestore();
  });

  it('stores bounded error name and code without the raw GraphQL error message', async () => {
    const { interceptor, prisma } = createInterceptor();
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-graphql-error' });
    const forbiddenMessage =
      'PRIVATE_VISIT_NOTE must never reach audit storage';
    const gqlSpy = jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: {
          user: { sub: 'user-graphql-2', organizationId: 'org-graphql-2' },
          ip: '203.0.113.21',
          headers: {},
        },
      }),
      getInfo: () => ({
        parentType: { name: 'Mutation' },
        fieldName: 'updateVisit',
      }),
      getArgs: () => ({
        input: {
          id: validIds.visit,
          status: 'COMPLETED',
          note: forbiddenMessage,
        },
      }),
    } as any);
    const failure = Object.assign(new Error(forbiddenMessage), {
      name: 'DomainConflict',
      code: 'VISIT_CONFLICT',
    });

    await expect(
      lastValueFrom(
        interceptor.intercept(
          { getType: () => 'graphql' } as any,
          { handle: () => throwError(() => failure) } as any,
        ),
      ),
    ).rejects.toBe(failure);
    await flushAuditWrite();

    const data = prisma.auditLog.create.mock.calls[0][0].data;
    expect(data.new_values).toEqual({
      id: validIds.visit,
      status: 'COMPLETED',
      errorName: 'DomainConflict',
      errorCode: 'VISIT_CONFLICT',
    });
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(
      forbiddenMessage,
    );
    gqlSpy.mockRestore();
  });

  it('extracts a bounded code from a real BaseHttpException without its response message', () => {
    const { interceptor } = createInterceptor();
    const forbiddenMessage = 'PRIVATE_BASE_HTTP_MESSAGE';
    const failure = new BaseHttpException(
      ErrorCode.VALIDATION_FAILED,
      forbiddenMessage,
      HttpStatus.BAD_REQUEST,
    );

    const metadata = (interceptor as any).extractSafeErrorMetadata(failure);

    expect(metadata).toEqual({
      errorName: 'BaseHttpException',
      errorCode: ErrorCode.VALIDATION_FAILED,
    });
    expect(JSON.stringify(metadata)).not.toContain(forbiddenMessage);
  });

  it('extracts a bounded GraphQL extensions code without its message or other extensions', () => {
    const { interceptor } = createInterceptor();
    const failure = new GraphQLError('PRIVATE_GRAPHQL_MESSAGE', {
      extensions: {
        code: 'FORBIDDEN',
        details: 'PRIVATE_GRAPHQL_DETAILS',
      },
    });

    const metadata = (interceptor as any).extractSafeErrorMetadata(failure);

    expect(metadata).toEqual({
      errorName: 'GraphQLError',
      errorCode: 'FORBIDDEN',
    });
    expect(JSON.stringify(metadata)).not.toContain('PRIVATE_');
  });

  it('logs metadata only when the database audit sink is unavailable', async () => {
    const interceptor = new AuditLogInterceptor();
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const forbidden = 'FALLBACK_PRIVATE_CLINICAL_TEXT';

    await (interceptor as any).logToDatabase({
      userId: 'user-fallback-1',
      organizationId: 'org-fallback-1',
      action: 'HTTP POST visits [ERROR 2ms]',
      resourceType: 'visits',
      resourceId: validIds.visit,
      ipAddress: forbidden,
      userAgent: forbidden,
      newValues: { note: forbidden, token: 'sk_fallback_forbidden' },
    });

    expect(logSpy).toHaveBeenCalledWith('AUDIT LOG (no DB):', {
      userId: 'user-fallback-1',
      organizationId: 'org-fallback-1',
      action: 'HTTP POST visits [ERROR 2ms]',
      resourceType: 'visits',
      resourceId: validIds.visit,
    });
    const logged = JSON.stringify(logSpy.mock.calls);
    expect(logged).not.toContain(forbidden);
    expect(logged).not.toContain('sk_fallback_forbidden');
    logSpy.mockRestore();
  });

  it('does not print raw Prisma messages or unsafe metadata summaries', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const forbidden = 'PRISMA_PRIVATE_VALUE must stay out of logs';
    const failure = Object.assign(new Error(forbidden), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: [forbidden] },
    });
    prisma.auditLog.create.mockRejectedValueOnce(failure);

    await (interceptor as any).logToDatabase(baseEntry);

    expect(errorSpy).toHaveBeenCalledWith('Failed to write audit log:', {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      modelName: undefined,
      fieldName: undefined,
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(forbidden);
    errorSpy.mockRestore();
  });

  it('does not inspect or persist request arguments for manually audited handlers', async () => {
    const prisma = { auditLog: { create: jest.fn() } };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const interceptor = new AuditLogInterceptor(
      prisma as any,
      reflector as any,
    );
    const next = { handle: jest.fn(() => of({ accepted: true })) };
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => {
          throw new Error('manual audit should bypass request body access');
        },
      }),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next as any)),
    ).resolves.toEqual({ accepted: true });
    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
