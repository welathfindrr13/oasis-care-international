import { Test, TestingModule } from '@nestjs/testing';
import { CarebridgeService } from '../carebridge.service';
import { CarebridgeRepository } from '../carebridge.repository';
import { PrismaService } from '@oasis/db';
import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ErrorCode } from '../../common/errors/error-codes';

describe('CarebridgeService', () => {
  let service: CarebridgeService;
  let repository: jest.Mocked<CarebridgeRepository>;

  const mockRepository = {
    ensureClientInOrganization: jest.fn(),
    createCareRoom: jest.fn(),
    ensurePolicyForRoom: jest.fn(),
    upsertFamilyContact: jest.fn(),
    createMembershipWithDefaultScopes: jest.fn(),
    listRoomsForOrganization: jest.fn(),
    listRoomsForFamilyAccess: jest.fn(),
    listRoomsForFamilyEmail: jest.fn(),
    findRoomByIdForOrganization: jest.fn(),
    findRoomByIdForFamilyAccess: jest.fn(),
    findRoomByIdForFamilyEmail: jest.fn(),
    listVerifiedVisitStoriesByRoomId: jest.fn(),
    listVerifiedVisitStoryApprovalQueue: jest.fn(),
    findVisitForStory: jest.fn(),
    createVerifiedVisitStory: jest.fn(),
    findVerifiedVisitStoryById: jest.fn(),
    publishVerifiedVisitStory: jest.fn(),
    rejectVerifiedVisitStory: jest.fn(),
    createConcern: jest.fn(),
    appendConcernEvent: jest.fn(),
    listConcernsForOrganization: jest.fn(),
    findConcernById: jest.fn(),
    updateConcern: jest.fn(),
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
      ],
    }).compile();

    service = module.get(CarebridgeService);
    repository = module.get(CarebridgeRepository);
    jest.clearAllMocks();
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

  it('lists care rooms for a family user by email instead of organization scope', async () => {
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
      },
    ] as any);

    const result = await service.listCareRooms({
      role: 'user',
      email: 'daughter@example.com',
    });

    expect(repository.listRoomsForFamilyAccess).toHaveBeenCalledWith({
      authSubject: undefined,
      email: 'daughter@example.com',
    });
    expect(result).toHaveLength(1);
    expect(result[0].client?.fullName).toBe('Mary Smith');
  });

  it('lists care rooms for a family user by verified auth subject when email is absent', async () => {
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
      },
    ] as any);

    const result = await service.listCareRooms({
      role: 'user',
      userId: 'clerk-family-subject',
      authSubject: 'clerk-family-subject',
    });

    expect(repository.listRoomsForFamilyAccess).toHaveBeenCalledWith({
      authSubject: 'clerk-family-subject',
      email: undefined,
    });
    expect(result).toHaveLength(1);
    expect(result[0].client?.fullName).toBe('Mary Smith');
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
      },
    ] as any);

    const result = await service.listCareRooms({
      role: 'client',
      email: 'daughter@example.com',
    });

    expect(repository.listRoomsForFamilyAccess).toHaveBeenCalledWith({
      authSubject: undefined,
      email: 'daughter@example.com',
    });
    expect(result).toHaveLength(1);
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
      status: 'DRAFT',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
    } as any);

    const result = await service.generateVerifiedVisitStory('visit-1', 'admin-1', 'org-1');

    expect(repository.createVerifiedVisitStory).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        visit_id: 'visit-1',
        status: 'DRAFT',
        source_refs: expect.arrayContaining([{ type: 'Visit', id: 'visit-1' }]),
      })
    );
    expect(result.id).toBe('story-1');
  });

  it('refuses to publish a verified visit story without source references', async () => {
    repository.findVerifiedVisitStoryById.mockResolvedValue({
      id: 'story-1',
      source_refs: [],
    } as any);

    await expect(
      service.publishVerifiedVisitStory('story-1', 'admin-1', 'org-1')
    ).rejects.toThrow(BaseHttpException);
  });

  it('requires an actor user id when publishing a verified visit story', async () => {
    repository.findVerifiedVisitStoryById.mockResolvedValue({
      id: 'story-1',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
      draft_title: 'Visit recorded',
      draft_body: 'Draft body',
    } as any);

    await expect(
      service.publishVerifiedVisitStory('story-1', '', 'org-1')
    ).rejects.toMatchObject({
      response: { code: ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS },
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
        role: 'carer',
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
    } as any);
    repository.listVerifiedVisitStoriesByRoomId.mockResolvedValue([] as any);

    await service.listVerifiedVisitStories('room-1', {
      role: 'user',
      email: 'daughter@example.com',
    });

    expect(repository.listVerifiedVisitStoriesByRoomId).toHaveBeenCalledWith('room-1', 'PUBLISHED');
  });

  it('raises a concern with SLA timestamps and an initial event', async () => {
    repository.findRoomByIdForFamilyAccess.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
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
      { role: 'user', email: 'daughter@example.com' }
    );

    expect(repository.createConcern).toHaveBeenCalledWith(
      expect.objectContaining({
        care_room_id: 'room-1',
        status: 'OPEN',
        acknowledgement_due_at: expect.any(Date),
        response_due_at: expect.any(Date),
        resolution_due_at: expect.any(Date),
      })
    );
    expect(repository.appendConcernEvent).toHaveBeenCalled();
    expect(result.id).toBe('concern-1');
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
      role: 'carer',
      organizationId: 'org-1',
      userId: 'staff-1',
    });

    expect(repository.listConcernsForOrganization).toHaveBeenCalledWith('org-1', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].careRoomId).toBe('room-1');
    expect(result[0].acknowledgedAt).toBeNull();
  });
});
