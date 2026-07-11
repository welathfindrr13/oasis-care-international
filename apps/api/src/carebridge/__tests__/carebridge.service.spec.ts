import { Test, TestingModule } from '@nestjs/testing';
import { CarebridgeService } from '../carebridge.service';
import { CarebridgeRepository } from '../carebridge.repository';
import {
  AccessGrantScope,
  FamilyPulseSentiment,
  PrismaService,
} from '@oasis/db';
import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { CarebridgeAccessService } from '../access/carebridge-access.service';

describe('CarebridgeService', () => {
  let service: CarebridgeService;
  let repository: jest.Mocked<CarebridgeRepository>;
  let accessService: jest.Mocked<CarebridgeAccessService>;

  const familyMembership = (identity: { authSubject?: string; email?: string }) => ({
    id: 'membership-1',
    status: 'ACTIVE',
    role: 'FAMILY',
    access_basis: 'CLIENT_CONSENT',
    family_contact: {
      id: 'contact-1',
      organization_id: 'org-1',
      auth_subject: identity.authSubject ?? null,
      email: identity.email ?? null,
      full_name: 'Authorized Relative',
      relationship: 'Daughter',
      disabled_at: null,
    },
    access_grants: [],
    organization_membership_invitation: {
      organization_id: 'org-1',
      intended_role: 'family',
      status: 'ACCEPTED',
      bound_auth_subject: identity.authSubject ?? null,
      activated_membership: {
        organization_id: 'org-1',
        auth_subject: identity.authSubject ?? null,
        role: 'family',
        status: 'ACTIVE',
        revoked_at: null,
      },
    },
  });

  const mockRepository = {
    ensureClientInOrganization: jest.fn(),
    createCareRoom: jest.fn(),
    ensurePolicyForRoom: jest.fn(),
    updatePolicy: jest.fn(),
    listRoomsForOrganization: jest.fn(),
    listRoomsForFamilyAccess: jest.fn(),
    findRoomByIdForOrganization: jest.fn(),
    findRoomByIdForFamilyAccess: jest.fn(),
    listVerifiedVisitStoriesByRoomId: jest.fn(),
    listFamilySafePublishedStoriesByRoomId: jest.fn(),
    listVerifiedVisitStoryApprovalQueue: jest.fn(),
    findVisitForStory: jest.fn(),
    createVerifiedVisitStory: jest.fn(),
    findVerifiedVisitStoryById: jest.fn(),
    publishVerifiedVisitStory: jest.fn(),
    rejectVerifiedVisitStory: jest.fn(),
    createConcern: jest.fn(),
    appendConcernEvent: jest.fn(),
    appendConcernMessage: jest.fn(),
    createFamilyPulse: jest.fn(),
    listConcernsForOrganization: jest.fn(),
    findConcernById: jest.fn(),
    updateConcern: jest.fn(),
  };

  const mockAccessService = {
    requireFamilyScopes: jest.fn().mockResolvedValue({ id: 'membership-1' }),
  };

  const mockPrisma = {
    organization: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarebridgeService,
        {
          provide: CarebridgeRepository,
          useValue: mockRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CarebridgeAccessService,
          useValue: mockAccessService,
        },
      ],
    }).compile();

    service = module.get(CarebridgeService);
    repository = module.get(CarebridgeRepository);
    accessService = module.get(CarebridgeAccessService);
    jest.clearAllMocks();
    mockAccessService.requireFamilyScopes.mockResolvedValue({ id: 'membership-1' });
  });

  it('creates a care room and ensures a default policy exists', async () => {
    repository.ensureClientInOrganization.mockResolvedValue(true);
    repository.createCareRoom.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      status: 'ACTIVE',
      created_at: new Date('2026-04-21T09:00:00Z'),
      updated_at: new Date('2026-04-21T09:00:00Z'),
      client: {
        id: 'client-1',
        full_name: 'Mary Smith',
      },
    } as any);

    const result = await service.createCareRoom('client-1', 'admin-1', 'admin', 'org-1');

    expect(repository.ensureClientInOrganization).toHaveBeenCalledWith('client-1', 'org-1');
    expect(repository.ensurePolicyForRoom).toHaveBeenCalledWith('room-1', 'org-1', 'client-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'admin-1',
        action: 'CAREBRIDGE_ROOM_CREATED',
        new_values: { clientId: 'client-1' },
      }),
    });
    expect(result.id).toBe('room-1');
    expect(result.client?.fullName).toBe('Mary Smith');
  });

  it('denies care room creation when the client is outside the organization', async () => {
    repository.ensureClientInOrganization.mockResolvedValue(false);

    await expect(
      service.createCareRoom('client-1', 'admin-1', 'admin', 'org-1')
    ).rejects.toMatchObject({
      response: { code: ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY },
    });
  });

  it('tenant-stamps policy audits from the authorized room', async () => {
    repository.findRoomByIdForOrganization.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
    } as any);
    repository.updatePolicy.mockResolvedValue({
      id: 'policy-1',
      show_visit_times_default: true,
      show_task_summary_default: true,
      show_medication_support_default: false,
      require_approval_for_all_content: true,
      family_can_raise_concerns: true,
      family_can_reply_to_concerns: true,
      family_can_submit_pulse: true,
    } as any);

    await service.updatePolicy(
      { careRoomId: 'room-1', showVisitTimesDefault: true },
      'admin-1',
      'admin',
      'org-1',
    );

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'admin-1',
        action: 'CAREBRIDGE_POLICY_UPDATED',
        new_values: { careRoomId: 'room-1' },
      }),
    });
  });

  it('lists family-safe care rooms by verified auth subject only', async () => {
    repository.listRoomsForFamilyAccess.mockResolvedValue([
      {
        id: 'room-1',
        organization_id: 'org-1',
        client_id: 'client-1',
        status: 'ACTIVE',
        created_at: new Date('2026-04-21T09:00:00Z'),
        updated_at: new Date('2026-04-21T09:00:00Z'),
        client: {
          id: 'client-1',
          full_name: 'Mary Smith',
        },
        memberships: [familyMembership({ authSubject: 'clerk-family-subject' })],
      },
    ] as any);

    const result = await service.listFamilyCareRooms({
      role: 'user',
      organizationId: 'org-1',
      userId: 'clerk-family-subject',
      authSubject: 'clerk-family-subject',
    });

    expect(repository.listRoomsForFamilyAccess).toHaveBeenCalledWith({
      organizationId: 'org-1',
      authSubject: 'clerk-family-subject',
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 'room-1', clientDisplayName: 'Mary Smith' });
  });

  it('treats client-scoped external viewers as family access rather than staff access', async () => {
    repository.listRoomsForFamilyAccess.mockResolvedValue([
      {
        id: 'room-1',
        organization_id: 'org-1',
        client_id: 'client-1',
        status: 'ACTIVE',
        created_at: new Date('2026-04-21T09:00:00Z'),
        updated_at: new Date('2026-04-21T09:00:00Z'),
        client: {
          id: 'client-1',
          full_name: 'Mary Smith',
        },
        memberships: [familyMembership({ authSubject: 'family-subject' })],
      },
    ] as any);

    const result = await service.listFamilyCareRooms({
      role: 'client',
      organizationId: 'org-1',
      authSubject: 'family-subject',
    });

    expect(repository.listRoomsForFamilyAccess).toHaveBeenCalledWith({
      organizationId: 'org-1',
      authSubject: 'family-subject',
    });
    expect(result).toHaveLength(1);
  });

  it('denies a family viewer with no tenant before any family repository access', async () => {
    const viewer = { role: 'user', authSubject: 'family-subject' };
    const actions = [
      () => service.listFamilyCareRooms(viewer),
      () => service.getFamilyCareRoom('room-1', viewer),
      () => service.listFamilyVerifiedVisitStories('room-1', viewer),
      () => service.raiseConcern({
        careRoomId: 'room-1',
        title: 'Concern',
        severity: 'MEDIUM' as any,
        category: 'COMMUNICATION' as any,
      }, viewer),
      () => service.submitFamilyPulse({
        careRoomId: 'room-1',
        sentiment: 'OK' as any,
      }, viewer),
    ];

    for (const action of actions) {
      await expect(action()).rejects.toMatchObject({
        status: 403,
        response: {
          code: ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
          message: 'Family access is not permitted.',
        },
      });
    }

    expect(repository.listRoomsForFamilyAccess).not.toHaveBeenCalled();
    expect(repository.findRoomByIdForFamilyAccess).not.toHaveBeenCalled();
    expect(repository.listFamilySafePublishedStoriesByRoomId).not.toHaveBeenCalled();
    expect(repository.createConcern).not.toHaveBeenCalled();
    expect(accessService.requireFamilyScopes).not.toHaveBeenCalled();
  });

  it('denies a family viewer with no identity before any family repository access', async () => {
    const viewer = { role: 'user', organizationId: 'org-1' };
    const actions = [
      () => service.listFamilyCareRooms(viewer),
      () => service.getFamilyCareRoom('room-1', viewer),
      () => service.listFamilyVerifiedVisitStories('room-1', viewer),
      () => service.raiseConcern({
        careRoomId: 'room-1',
        title: 'Concern',
        severity: 'MEDIUM' as any,
        category: 'COMMUNICATION' as any,
      }, viewer),
      () => service.submitFamilyPulse({
        careRoomId: 'room-1',
        sentiment: 'OK' as any,
      }, viewer),
    ];

    for (const action of actions) {
      await expect(action()).rejects.toMatchObject({
        status: 403,
        response: {
          code: ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
          message: 'Family access is not permitted.',
        },
      });
    }

    expect(repository.listRoomsForFamilyAccess).not.toHaveBeenCalled();
    expect(repository.findRoomByIdForFamilyAccess).not.toHaveBeenCalled();
    expect(repository.listFamilySafePublishedStoriesByRoomId).not.toHaveBeenCalled();
    expect(repository.createConcern).not.toHaveBeenCalled();
    expect(accessService.requireFamilyScopes).not.toHaveBeenCalled();
  });

  it('does not expose memberships, grants, contact email, or policy in the family room shape', async () => {
    repository.listRoomsForFamilyAccess.mockResolvedValue([
      {
        id: 'room-1',
        organization_id: 'org-1',
        client_id: 'client-1',
        status: 'ACTIVE',
        created_at: new Date('2026-04-21T09:00:00Z'),
        updated_at: new Date('2026-04-21T09:00:00Z'),
        client: { id: 'client-1', full_name: 'Mary Smith' },
        memberships: [
          {
            id: 'membership-authorized',
            status: 'ACTIVE',
            role: 'FAMILY',
            access_basis: 'CLIENT_CONSENT',
            family_contact: {
              id: 'contact-authorized',
              organization_id: 'org-1',
              auth_subject: 'family-subject',
              email: 'daughter@example.com',
              full_name: 'Authorized Relative',
              relationship: 'Daughter',
              disabled_at: null,
            },
            access_grants: [
              { id: 'grant-authorized', scope: 'VIEW_UPDATES', granted_at: new Date(), revoked_at: null },
            ],
            organization_membership_invitation: {
              organization_id: 'org-1',
              intended_role: 'family',
              status: 'ACCEPTED',
              bound_auth_subject: 'family-subject',
              activated_membership: {
                auth_subject: 'family-subject',
                status: 'ACTIVE',
                revoked_at: null,
              },
            },
          },
          {
            id: 'membership-other',
            status: 'ACTIVE',
            role: 'FAMILY',
            access_basis: 'CLIENT_CONSENT',
            family_contact: {
              id: 'contact-other',
              organization_id: 'org-1',
              auth_subject: 'other-subject',
              email: 'daughter@example.com',
              full_name: 'Other Relative',
              relationship: 'Son',
              disabled_at: null,
            },
            access_grants: [
              { id: 'grant-other', scope: 'VIEW_UPDATES', granted_at: new Date(), revoked_at: null },
            ],
          },
          {
            id: 'membership-disabled',
            status: 'ACTIVE',
            role: 'FAMILY',
            access_basis: 'CLIENT_CONSENT',
            family_contact: {
              id: 'contact-disabled',
              organization_id: 'org-1',
              auth_subject: 'family-subject',
              email: 'daughter@example.com',
              full_name: 'Disabled Relative',
              relationship: 'Daughter',
              disabled_at: new Date(),
            },
            access_grants: [],
          },
          {
            id: 'membership-inactive',
            status: 'REVOKED',
            role: 'FAMILY',
            access_basis: 'CLIENT_CONSENT',
            family_contact: {
              id: 'contact-inactive',
              organization_id: 'org-1',
              auth_subject: 'family-subject',
              email: 'daughter@example.com',
              full_name: 'Inactive Relative',
              relationship: 'Daughter',
              disabled_at: null,
            },
            access_grants: [],
          },
          {
            id: 'membership-other-tenant',
            status: 'ACTIVE',
            role: 'FAMILY',
            access_basis: 'CLIENT_CONSENT',
            family_contact: {
              id: 'contact-other-tenant',
              organization_id: 'org-2',
              auth_subject: 'family-subject',
              email: 'daughter@example.com',
              full_name: 'Other Tenant Relative',
              relationship: 'Daughter',
              disabled_at: null,
            },
            access_grants: [],
          },
        ],
      },
    ] as any);

    const result = await service.listFamilyCareRooms({
      role: 'user',
      organizationId: 'org-1',
      authSubject: 'family-subject',
    });

    expect(result[0]).toEqual({ id: 'room-1', clientDisplayName: 'Mary Smith' });
    expect(result[0]).not.toHaveProperty('memberships');
    expect(result[0]).not.toHaveProperty('policy');
  });

  it('keeps staff room listing on the organization path', async () => {
    repository.listRoomsForOrganization.mockResolvedValue([]);

    await service.listCareRooms({ role: 'admin', organizationId: 'org-1' });

    expect(repository.listRoomsForOrganization).toHaveBeenCalledWith('org-1');
    expect(repository.listRoomsForFamilyAccess).not.toHaveBeenCalled();
  });

  it('keeps staff room detail on the organization path', async () => {
    repository.findRoomByIdForOrganization.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      memberships: [],
    } as any);

    const result = await service.getCareRoom('room-1', {
      role: 'admin',
      organizationId: 'org-1',
    });

    expect(repository.findRoomByIdForOrganization).toHaveBeenCalledWith('room-1', 'org-1');
    expect(repository.findRoomByIdForFamilyAccess).not.toHaveBeenCalled();
    expect(accessService.requireFamilyScopes).not.toHaveBeenCalled();
    expect(result.id).toBe('room-1');
  });

  it('requires update scope for family room detail', async () => {
    repository.findRoomByIdForFamilyAccess.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      memberships: [familyMembership({ authSubject: 'family-subject' })],
    } as any);

    await service.getFamilyCareRoom('room-1', {
      role: 'user',
      organizationId: 'org-1',
      authSubject: 'family-subject',
    });

    expect(accessService.requireFamilyScopes).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: 'membership-1',
        careRoomId: 'room-1',
        organizationId: 'org-1',
        requiredScopes: [AccessGrantScope.VIEW_UPDATES],
      }),
    );
  });

  it('denies an email-only family identity before repository access', async () => {
    await expect(
      service.listFamilyCareRooms({
        role: 'user',
        organizationId: 'org-1',
        email: 'shared@example.com',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.listRoomsForFamilyAccess).not.toHaveBeenCalled();
  });

  it('creates a verified visit story with source references', async () => {
    repository.findVisitForStory.mockResolvedValue({
      id: 'visit-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      scheduled_start: new Date('2026-04-21T09:00:00Z'),
      scheduled_end: new Date('2026-04-21T10:00:00Z'),
      actual_start: new Date('2026-04-21T09:03:00Z'),
      actual_end: new Date('2026-04-21T09:58:00Z'),
      status: 'COMPLETED',
      notes: 'Client was comfortable and had breakfast support.',
      client: { id: 'client-1', full_name: 'Mary Smith' },
      carer: { id: 'carer-1', first_name: 'Amira', last_name: 'Khan' },
      tasks: [
        { id: 'task-1', task_name: 'Breakfast support', is_completed: true },
        { id: 'task-2', task_name: 'Medication prompt', is_completed: false },
      ],
    } as any);
    repository.createVerifiedVisitStory.mockResolvedValue({
      id: 'story-1',
      organization_id: 'org-1',
      status: 'DRAFT',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
    } as any);

    const result = await service.generateVerifiedVisitStory('visit-1', 'admin-1', 'org-1');

    expect(repository.createVerifiedVisitStory).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        visit_id: 'visit-1',
        status: 'DRAFT',
        family_safe_version: 1,
        family_safe_title: 'Care visit update',
        family_safe_body: 'The scheduled care visit was completed. One care task was recorded as completed. 1 care task needs follow-up.',
        source_refs: expect.arrayContaining([{ type: 'Visit', id: 'visit-1' }]),
      })
    );
    expect(result.id).toBe('story-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'admin-1',
        action: 'CAREBRIDGE_VISIT_STORY_DRAFTED',
        new_values: { visitId: 'visit-1', careRoomId: 'room-client-1' },
      }),
    });
  });

  it('refuses to generate family proof for a visit that is not completed', async () => {
    repository.findVisitForStory.mockResolvedValue({
      id: 'visit-scheduled',
      organization_id: 'org-1',
      client_id: 'client-1',
      status: 'SCHEDULED',
      client: { id: 'client-1', full_name: 'Mary Smith' },
      tasks: [],
    } as any);

    await expect(
      service.generateVerifiedVisitStory('visit-scheduled', 'admin-1', 'org-1'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.VALIDATION_FAILED },
    });
    expect(repository.createVerifiedVisitStory).not.toHaveBeenCalled();
  });

  it('refuses to publish a verified visit story without source references', async () => {
    repository.findVerifiedVisitStoryById.mockResolvedValue({
      id: 'story-1',
      status: 'DRAFT',
      source_refs: [],
    } as any);

    await expect(
      service.publishVerifiedVisitStory('story-1', 'admin-1', 'org-1')
    ).rejects.toThrow(BaseHttpException);
  });

  it('refuses to publish a legacy story without versioned family-safe content', async () => {
    repository.findVerifiedVisitStoryById.mockResolvedValue({
      id: 'story-legacy',
      organization_id: 'org-1',
      status: 'DRAFT',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
      draft_title: 'Medication visit',
      draft_body: 'Raw medication notes that must not reach family.',
      family_safe_version: null,
      family_safe_title: null,
      family_safe_body: null,
    } as any);

    await expect(
      service.publishVerifiedVisitStory('story-legacy', 'admin-1', 'org-1'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.VALIDATION_FAILED },
    });
    expect(repository.publishVerifiedVisitStory).not.toHaveBeenCalled();
  });

  it('refuses to publish family proof when the linked visit is not completed', async () => {
    repository.findVerifiedVisitStoryById.mockResolvedValue({
      id: 'story-scheduled',
      organization_id: 'org-1',
      status: 'DRAFT',
      source_refs: [{ type: 'Visit', id: 'visit-scheduled' }],
      family_safe_version: 1,
      family_safe_title: 'Care visit update',
      family_safe_body: 'A scheduled care visit update is available.',
      visit: { status: 'SCHEDULED' },
    } as any);

    await expect(
      service.publishVerifiedVisitStory('story-scheduled', 'admin-1', 'org-1'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.VALIDATION_FAILED },
    });
    expect(repository.publishVerifiedVisitStory).not.toHaveBeenCalled();
  });

  it('refuses to publish a rejected story', async () => {
    repository.findVerifiedVisitStoryById.mockResolvedValue({
      id: 'story-rejected',
      organization_id: 'org-1',
      status: 'REJECTED',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
      family_safe_version: 1,
      family_safe_title: 'Care visit update',
      family_safe_body: 'A scheduled care visit update is available.',
      visit: { status: 'COMPLETED', deleted_at: null },
    } as any);

    await expect(
      service.publishVerifiedVisitStory('story-rejected', 'admin-1', 'org-1'),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: ErrorCode.VALIDATION_FAILED },
    });
    expect(repository.publishVerifiedVisitStory).not.toHaveBeenCalled();
  });

  it('requires an actor user id when publishing a verified visit story', async () => {
    repository.findVerifiedVisitStoryById.mockResolvedValue({
      id: 'story-1',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
      draft_title: 'Visit recorded',
      draft_body: 'Draft body',
      family_safe_version: 1,
      family_safe_title: 'Care visit update',
      family_safe_body: 'A scheduled care visit update is available.',
      visit: { status: 'COMPLETED' },
    } as any);

    await expect(
      service.publishVerifiedVisitStory('story-1', '', 'org-1')
    ).rejects.toMatchObject({
      response: { code: ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS },
    });
  });

  it('tenant-stamps published story audits from the authorized story', async () => {
    repository.findVerifiedVisitStoryById.mockResolvedValue({
      id: 'story-1',
      organization_id: 'org-1',
      status: 'DRAFT',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
      draft_title: 'Visit recorded',
      draft_body: 'Draft body',
      family_safe_version: 1,
      family_safe_title: 'Care visit update',
      family_safe_body: 'A scheduled care visit update is available.',
      visit: { status: 'COMPLETED' },
    } as any);
    repository.publishVerifiedVisitStory.mockResolvedValue({
      id: 'story-1',
      status: 'PUBLISHED',
      approved_title: 'Visit recorded',
      approved_body: 'Draft body',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
    } as any);

    await service.publishVerifiedVisitStory('story-1', 'admin-1', 'org-1');

    expect(repository.publishVerifiedVisitStory).toHaveBeenCalledWith(
      'story-1',
      'Care visit update',
      'A scheduled care visit update is available.',
      'admin-1',
    );

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'admin-1',
        action: 'CAREBRIDGE_VISIT_STORY_PUBLISHED',
        new_values: {
          familySafeVersion: 1,
          familySafeDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      }),
    });
  });

  it('lists draft approval queue items for a staff organization', async () => {
    repository.listVerifiedVisitStoryApprovalQueue.mockResolvedValue([
      {
        id: 'story-1',
        status: 'DRAFT',
        draft_title: 'Visit recorded',
        draft_body: 'Draft body',
        source_refs: [{ type: 'Visit', id: 'visit-1' }],
        created_at: new Date('2026-04-22T09:00:00Z'),
      },
    ] as any);

    const result = await service.listVerifiedVisitStoryApprovalQueue({
      role: 'admin',
      organizationId: 'org-1',
    });

    expect(repository.listVerifiedVisitStoryApprovalQueue).toHaveBeenCalledWith('org-1', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('DRAFT');
  });

  it('supports care room filtering on the draft approval queue', async () => {
    repository.findRoomByIdForOrganization.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
    } as any);
    repository.listVerifiedVisitStoryApprovalQueue.mockResolvedValue([] as any);

    await service.listVerifiedVisitStoryApprovalQueue(
      {
        role: 'admin',
        organizationId: 'org-1',
      },
      'room-1'
    );

    expect(repository.findRoomByIdForOrganization).toHaveBeenCalledWith('room-1', 'org-1');
    expect(repository.listVerifiedVisitStoryApprovalQueue).toHaveBeenCalledWith('org-1', 'room-1');
  });

  it('rejects a verified visit story with an explicit reason', async () => {
    repository.findVerifiedVisitStoryById.mockResolvedValue({
      id: 'story-1',
      organization_id: 'org-1',
      status: 'DRAFT',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
    } as any);
    repository.rejectVerifiedVisitStory.mockResolvedValue({
      id: 'story-1',
      status: 'REJECTED',
      draft_title: 'Visit recorded',
      draft_body: 'Needs timeline correction',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
      rejection_reason: 'Need clearer timeline details',
      rejected_at: new Date('2026-04-22T11:00:00Z'),
    } as any);

    const result = await service.rejectVerifiedVisitStory(
      'story-1',
      'Need clearer timeline details',
      'admin-1',
      'org-1'
    );

    expect(repository.rejectVerifiedVisitStory).toHaveBeenCalledWith('story-1', 'Need clearer timeline details');
    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toBe('Need clearer timeline details');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'admin-1',
        action: 'CAREBRIDGE_VISIT_STORY_REJECTED',
        new_values: { rejectionReason: 'Need clearer timeline details' },
      }),
    });
  });

  it('requires a rejection reason when rejecting a verified visit story', async () => {
    await expect(
      service.rejectVerifiedVisitStory('story-1', '   ', 'admin-1', 'org-1')
    ).rejects.toMatchObject({
      response: { code: ErrorCode.VALIDATION_FAILED },
    });
  });

  it('keeps family users limited to published verified visit stories', async () => {
    repository.findRoomByIdForFamilyAccess.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      memberships: [familyMembership({ authSubject: 'family-subject' })],
    } as any);
    repository.listFamilySafePublishedStoriesByRoomId.mockResolvedValue([
      {
        family_safe_title: 'Care visit update',
        family_safe_body: 'The visit was completed and two care tasks were recorded.',
        published_at: new Date('2026-04-22T09:00:00Z'),
      },
    ] as any);

    const result = await service.listFamilyVerifiedVisitStories('room-1', {
      role: 'user',
      organizationId: 'org-1',
      authSubject: 'family-subject',
    });

    expect(repository.listFamilySafePublishedStoriesByRoomId).toHaveBeenCalledWith('room-1');
    expect(accessService.requireFamilyScopes).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredScopes: [
          AccessGrantScope.VIEW_UPDATES,
          AccessGrantScope.VIEW_TASK_SUMMARY,
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: 'Care visit update',
      body: 'The visit was completed and two care tasks were recorded.',
      publishedAt: new Date('2026-04-22T09:00:00Z'),
    });
    expect(result[0]).not.toHaveProperty('sourceRefs');
    expect(result[0]).not.toHaveProperty('draftBody');
  });

  it('does not read published stories when any required scope is denied', async () => {
    repository.findRoomByIdForFamilyAccess.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      memberships: [familyMembership({ authSubject: 'family-subject' })],
    } as any);
    accessService.requireFamilyScopes.mockRejectedValue(
      new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Family access is not permitted for this care room.',
        403,
      ),
    );

    await expect(
      service.listFamilyVerifiedVisitStories('room-1', {
        role: 'user',
        organizationId: 'org-1',
        authSubject: 'family-subject',
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(repository.listFamilySafePublishedStoriesByRoomId).not.toHaveBeenCalled();
  });

  it('raises a concern with SLA timestamps and an initial event', async () => {
    repository.findRoomByIdForFamilyAccess.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      memberships: [familyMembership({ authSubject: 'family-subject' })],
    } as any);
    repository.createConcern.mockResolvedValue({
      id: 'concern-1',
      status: 'OPEN',
    } as any);

    const result = await service.raiseConcern(
      {
        careRoomId: 'room-1',
        title: 'Missed breakfast support',
        description: 'Mum says breakfast was not prepared.',
        severity: 'MEDIUM',
        category: 'VISIT_DELIVERY',
      },
      { role: 'user', organizationId: 'org-1', authSubject: 'family-subject' }
    );

    expect(repository.createConcern).toHaveBeenCalledWith(
      expect.objectContaining({
        care_room_id: 'room-1',
        raised_by_membership_id: 'membership-1',
        status: 'OPEN',
        acknowledgement_due_at: expect.any(Date),
        response_due_at: expect.any(Date),
        resolution_due_at: expect.any(Date),
      })
    );
    expect(repository.appendConcernEvent).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'family-subject',
        action: 'CAREBRIDGE_CONCERN_RAISED',
        new_values: { careRoomId: 'room-1' },
      }),
    });
    expect(accessService.requireFamilyScopes).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: 'membership-1',
        requiredScopes: [AccessGrantScope.RAISE_CONCERNS],
      }),
    );
    expect(result.id).toBe('concern-1');
  });

  it('keeps staff concern creation organization-scoped without family attribution', async () => {
    repository.findRoomByIdForOrganization.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
    } as any);
    repository.createConcern.mockResolvedValue({ id: 'concern-1', status: 'OPEN' } as any);

    await service.raiseConcern(
      {
        careRoomId: 'room-1',
        title: 'Staff concern',
        severity: 'MEDIUM',
        category: 'VISIT_DELIVERY',
      },
      { role: 'admin', organizationId: 'org-1', userId: 'staff-1' },
    );

    expect(accessService.requireFamilyScopes).not.toHaveBeenCalled();
    expect(repository.createConcern).toHaveBeenCalledWith(
      expect.not.objectContaining({ raised_by_membership_id: expect.anything() }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'staff-1',
        action: 'CAREBRIDGE_CONCERN_RAISED',
      }),
    });
  });

  it('requires only pulse scope for a non-escalating family pulse', async () => {
    repository.findRoomByIdForFamilyAccess.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      memberships: [familyMembership({ authSubject: 'family-subject' })],
    } as any);
    repository.createFamilyPulse.mockResolvedValue({
      id: 'pulse-1',
      organization_id: 'org-1',
      sentiment: FamilyPulseSentiment.CONFIDENT,
      note: null,
      created_at: new Date('2026-04-24T09:00:00Z'),
    } as any);

    await service.submitFamilyPulse(
      {
        careRoomId: 'room-1',
        sentiment: FamilyPulseSentiment.CONFIDENT,
      },
      { role: 'user', organizationId: 'org-1', authSubject: 'family-subject' },
    );

    expect(accessService.requireFamilyScopes).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: 'membership-1',
        requiredScopes: [AccessGrantScope.SUBMIT_PULSE],
      }),
    );
    expect(repository.createConcern).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'family-subject',
        action: 'CAREBRIDGE_PULSE_SUBMITTED',
        new_values: { sentiment: FamilyPulseSentiment.CONFIDENT },
      }),
    });
  });

  it('preflights both scopes before an escalating pulse and reuses membership attribution', async () => {
    repository.findRoomByIdForFamilyAccess.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      memberships: [familyMembership({ authSubject: 'family-subject' })],
    } as any);
    repository.createFamilyPulse.mockResolvedValue({
      id: 'pulse-1',
      organization_id: 'org-1',
      sentiment: FamilyPulseSentiment.CONCERNED,
      note: 'Please call me.',
      created_at: new Date('2026-04-24T09:00:00Z'),
    } as any);
    repository.createConcern.mockResolvedValue({ id: 'concern-1', status: 'OPEN' } as any);

    await service.submitFamilyPulse(
      {
        careRoomId: 'room-1',
        sentiment: FamilyPulseSentiment.CONCERNED,
        note: 'Please call me.',
      },
      { role: 'user', organizationId: 'org-1', authSubject: 'family-subject' },
    );

    expect(accessService.requireFamilyScopes).toHaveBeenCalledTimes(1);
    expect(accessService.requireFamilyScopes).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: 'membership-1',
        requiredScopes: [
          AccessGrantScope.SUBMIT_PULSE,
          AccessGrantScope.RAISE_CONCERNS,
        ],
      }),
    );
    expect(accessService.requireFamilyScopes.mock.invocationCallOrder[0]).toBeLessThan(
      repository.createFamilyPulse.mock.invocationCallOrder[0],
    );
    expect(repository.createFamilyPulse).toHaveBeenCalledWith(
      expect.objectContaining({ care_room_membership_id: 'membership-1' }),
    );
    expect(repository.createConcern).toHaveBeenCalledWith(
      expect.objectContaining({ raised_by_membership_id: 'membership-1' }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'family-subject',
        action: 'CAREBRIDGE_PULSE_SUBMITTED',
        new_values: { sentiment: FamilyPulseSentiment.CONCERNED },
      }),
    });
    expect(mockPrisma.auditLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'family-subject',
        action: 'CAREBRIDGE_CONCERN_RAISED',
        new_values: { careRoomId: 'room-1' },
      }),
    });
  });

  it('performs zero pulse, concern, event, message, or audit writes when escalation scope is denied', async () => {
    repository.findRoomByIdForFamilyAccess.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      memberships: [familyMembership({ authSubject: 'family-subject' })],
    } as any);
    accessService.requireFamilyScopes.mockRejectedValue(
      new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Family access is not permitted for this care room.',
        403,
      ),
    );

    await expect(
      service.submitFamilyPulse(
        {
          careRoomId: 'room-1',
          sentiment: FamilyPulseSentiment.NEED_CALL,
          note: 'Please call me.',
        },
        { role: 'user', organizationId: 'org-1', authSubject: 'family-subject' },
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(repository.createFamilyPulse).not.toHaveBeenCalled();
    expect(repository.createConcern).not.toHaveBeenCalled();
    expect(repository.appendConcernEvent).not.toHaveBeenCalled();
    expect(repository.appendConcernMessage).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('lists the concern inbox for staff in the same organization', async () => {
    repository.listConcernsForOrganization.mockResolvedValue([
      {
        id: 'concern-1',
        care_room_id: 'room-1',
        client_id: 'client-1',
        title: 'Missed breakfast support',
        description: 'Family reported the visit felt rushed.',
        severity: 'MEDIUM',
        priority: 'ROUTINE',
        category: 'VISIT_DELIVERY',
        status: 'OPEN',
        outcome: null,
        acknowledgement_due_at: new Date('2026-04-23T12:00:00Z'),
        acknowledged_at: null,
        response_due_at: new Date('2026-04-23T15:00:00Z'),
        resolution_due_at: new Date('2026-04-24T11:00:00Z'),
        resolved_at: null,
        messages: [],
        events: [],
      },
    ] as any);

    const result = await service.listConcernInbox({
      role: 'admin',
      organizationId: 'org-1',
      userId: 'staff-1',
    });

    expect(repository.listConcernsForOrganization).toHaveBeenCalledWith('org-1', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].careRoomId).toBe('room-1');
    expect(result[0].acknowledgedAt).toBeNull();
  });

  it('tenant-stamps concern update audits from the authorized concern', async () => {
    repository.findConcernById.mockResolvedValue({
      id: 'concern-1',
      organization_id: 'org-1',
      status: 'OPEN',
    } as any);
    repository.updateConcern.mockResolvedValue({
      id: 'concern-1',
      care_room_id: 'room-1',
      client_id: 'client-1',
      title: 'Concern',
      severity: 'MEDIUM',
      priority: 'ROUTINE',
      category: 'VISIT_DELIVERY',
      status: 'ACKNOWLEDGED',
    } as any);

    await service.updateConcernStatus(
      { concernId: 'concern-1', status: 'ACKNOWLEDGED' as any },
      'staff-1',
      'admin',
      'org-1',
    );

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'staff-1',
        action: 'CAREBRIDGE_CONCERN_UPDATED',
        new_values: { status: 'ACKNOWLEDGED', outcome: null },
      }),
    });
  });
});
