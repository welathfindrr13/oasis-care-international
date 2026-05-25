import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@oasis/db';
import { CarebridgeConcernService } from './carebridge-concern.service';

describe('CarebridgeConcernService', () => {
  let service: CarebridgeConcernService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      careRoom: {
        findFirst: jest.fn(),
      },
      concern: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      concernEvent: {
        create: jest.fn(),
      },
      concernMessage: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarebridgeConcernService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(CarebridgeConcernService);
  });

  it('raises a concern with SLA timestamps and creates an audit event', async () => {
    prisma.careRoom.findFirst.mockResolvedValue({
      id: 'room-1',
      organization_id: 'org-1',
      client_id: 'client-1',
    });
    prisma.concern.create.mockResolvedValue({
      id: 'concern-1',
      status: 'OPEN',
      acknowledgement_due_at: new Date('2026-04-21T11:00:00Z'),
    });
    prisma.concern.findFirst.mockResolvedValue({
      id: 'concern-1',
      status: 'OPEN',
      messages: [],
      events: [],
    });

    const concern = await service.raiseConcern({
      careRoomId: 'room-1',
      organizationId: 'org-1',
      raisedByMembershipId: 'membership-1',
      title: 'Mum says nobody came',
      category: 'VISIT_DELIVERY' as any,
      severity: 'HIGH' as any,
      messageBody: 'Please check the morning visit.',
      now: new Date('2026-04-21T09:00:00Z'),
    });

    expect(prisma.concern.create).toHaveBeenCalled();
    expect(prisma.concernEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: 'RAISED',
        }),
      }),
    );
    expect(concern.status).toBe('OPEN');
  });

  it('records acknowledgement, response, and resolution as immutable events', async () => {
    prisma.concern.findFirst
      .mockResolvedValueOnce({
        id: 'concern-1',
        organization_id: 'org-1',
        status: 'OPEN',
      })
      .mockResolvedValueOnce({
        id: 'concern-1',
        status: 'ACKNOWLEDGED',
        messages: [],
        events: [],
      })
      .mockResolvedValueOnce({
        id: 'concern-1',
        organization_id: 'org-1',
        status: 'ACKNOWLEDGED',
      })
      .mockResolvedValueOnce({
        id: 'concern-1',
        status: 'IN_PROGRESS',
        messages: [],
        events: [],
      })
      .mockResolvedValueOnce({
        id: 'concern-1',
        organization_id: 'org-1',
        status: 'IN_PROGRESS',
      })
      .mockResolvedValueOnce({
        id: 'concern-1',
        status: 'RESOLVED',
        messages: [],
        events: [],
      });
    prisma.concern.update.mockResolvedValue({
      id: 'concern-1',
      status: 'RESOLVED',
    });

    await service.acknowledgeConcern({
      concernId: 'concern-1',
      organizationId: 'org-1',
      actorUserId: 'staff-1',
    });
    await service.respondToConcern({
      concernId: 'concern-1',
      organizationId: 'org-1',
      actorUserId: 'staff-1',
      body: 'We have checked the call log and are reviewing with the coordinator.',
    });
    await service.resolveConcern({
      concernId: 'concern-1',
      organizationId: 'org-1',
      actorUserId: 'staff-1',
      outcome: 'CALLBACK_COMPLETED',
      resolutionSummary: 'Coordinator called the family and confirmed the corrected schedule.',
    });

    expect(prisma.concernEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: 'ACKNOWLEDGED',
        }),
      }),
    );
    expect(prisma.concernMessage.create).toHaveBeenCalled();
    expect(prisma.concernEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: 'RESOLVED',
        }),
      }),
    );
  });
});
