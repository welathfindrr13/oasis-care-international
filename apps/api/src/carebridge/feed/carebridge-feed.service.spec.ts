import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@oasis/db';
import { CarebridgeFeedService } from './carebridge-feed.service';

describe('CarebridgeFeedService', () => {
  let service: CarebridgeFeedService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      whereNotDeleted: jest.fn((where) => where),
      careRoom: {
        findFirst: jest.fn(),
      },
      visit: {
        findFirst: jest.fn(),
      },
      verifiedVisitStory: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      careBridgePolicy: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarebridgeFeedService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(CarebridgeFeedService);
  });

  it('builds a draft verified visit story from operational records and hides medication support by policy', async () => {
    prisma.careRoom.findFirst.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
    });
    prisma.careBridgePolicy.findFirst.mockResolvedValue({
      show_medication_support_default: false,
    });
    prisma.visit.findFirst.mockResolvedValue({
      id: 'visit-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      scheduled_start: new Date('2026-04-21T09:00:00Z'),
      actual_start: new Date('2026-04-21T09:02:00Z'),
      actual_end: new Date('2026-04-21T09:48:00Z'),
      status: 'COMPLETED',
      carer: { first_name: 'Amina', last_name: 'Khan' },
      tasks: [
        { id: 'task-1', task_name: 'Breakfast support', is_completed: true },
        { id: 'task-2', task_name: 'Medication prompt', is_completed: false },
      ],
      care_logs: [
        { id: 'log-1', category: 'MOOD', notes: 'Client appeared in good spirits.' },
      ],
      medication_administrations: [
        { id: 'med-1', status: 'ADMINISTERED' },
      ],
    });
    prisma.verifiedVisitStory.findFirst.mockResolvedValue(null);
    prisma.verifiedVisitStory.create.mockResolvedValue({
      id: 'story-1',
      draft_title: 'Visit completed',
      draft_body: 'Draft',
      status: 'DRAFT',
      source_refs: [{ type: 'Visit', id: 'visit-1' }],
    });

    const story = await service.syncVerifiedVisitStory({
      visitId: 'visit-1',
      organizationId: 'org-1',
      actorUserId: 'staff-1',
    });

    expect(prisma.verifiedVisitStory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draft_body: expect.not.stringContaining('Medication support was recorded'),
        }),
      }),
    );
    expect(story.status).toBe('DRAFT');
  });

  it('projects medication support as status-only when policy allows medication visibility', async () => {
    prisma.careRoom.findFirst.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
    });
    prisma.careBridgePolicy.findFirst.mockResolvedValue({
      show_medication_support_default: true,
    });
    prisma.visit.findFirst.mockResolvedValue({
      id: 'visit-1',
      organization_id: 'org-1',
      client_id: 'client-1',
      scheduled_start: new Date('2026-04-21T09:00:00Z'),
      actual_start: new Date('2026-04-21T09:02:00Z'),
      actual_end: new Date('2026-04-21T09:48:00Z'),
      status: 'COMPLETED',
      carer: { first_name: 'Amina', last_name: 'Khan' },
      tasks: [],
      care_logs: [],
      medication_administrations: [
        {
          id: 'med-admin-1',
          status: 'ADMINISTERED',
          prescription: {
            medication: {
              name: 'Sensitive medication name',
              dosage: '10',
              unit: 'mg',
            },
          },
        },
      ],
    });
    prisma.verifiedVisitStory.findFirst.mockResolvedValue(null);
    prisma.verifiedVisitStory.create.mockResolvedValue({
      id: 'story-1',
      draft_title: 'Visit completed',
      draft_body: 'Medication support was recorded during this visit.',
      status: 'DRAFT',
      source_refs: [
        {
          type: 'MedicationAdministration',
          id: 'med-admin-1',
          visibility: 'STATUS_ONLY',
        },
      ],
    });

    await service.syncVerifiedVisitStory({
      visitId: 'visit-1',
      organizationId: 'org-1',
      actorUserId: 'staff-1',
    });

    expect(prisma.verifiedVisitStory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draft_body: expect.stringContaining('Medication support was recorded during this visit.'),
          source_refs: expect.arrayContaining([
            {
              type: 'MedicationAdministration',
              id: 'med-admin-1',
              visibility: 'STATUS_ONLY',
            },
          ]),
        }),
      }),
    );
    expect(prisma.verifiedVisitStory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draft_body: expect.not.stringContaining('Sensitive medication name'),
        }),
      }),
    );
    expect(prisma.verifiedVisitStory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draft_body: expect.not.stringContaining('10 mg'),
        }),
      }),
    );
  });

  it('refuses to publish a verified visit story that has no source references', async () => {
    prisma.verifiedVisitStory.findFirst.mockResolvedValue({
      id: 'story-1',
      organization_id: 'org-1',
      status: 'DRAFT',
      source_refs: [],
    });

    await expect(
      service.publishVerifiedVisitStory({
        storyId: 'story-1',
        organizationId: 'org-1',
        actorUserId: 'staff-1',
      }),
    ).rejects.toMatchObject({
      response: { code: 'VALIDATION_FAILED' },
    });
  });

  it('lists only published visit stories for the requested care room', async () => {
    prisma.verifiedVisitStory.findMany.mockResolvedValue([
      {
        id: 'story-published',
        care_room_id: 'room-1',
        status: 'PUBLISHED',
        approved_title: 'Approved update',
      },
    ]);

    const stories = await service.listPublishedStoriesForRoom('room-1');

    expect(prisma.verifiedVisitStory.findMany).toHaveBeenCalledWith({
      where: {
        care_room_id: 'room-1',
        status: 'PUBLISHED',
      },
      orderBy: {
        published_at: 'desc',
      },
    });
    expect(stories).toHaveLength(1);
    expect(stories[0].id).toBe('story-published');
  });
});
