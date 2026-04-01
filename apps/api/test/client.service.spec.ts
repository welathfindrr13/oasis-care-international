import { Test, TestingModule } from '@nestjs/testing';
import { ClientService } from '../src/client/client.service';
import { ClientRepository } from '../src/client/client.repository';

describe('ClientService', () => {
  let service: ClientService;

  const mockClientRepository = {
    findMany: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        {
          provide: ClientRepository,
          useValue: mockClientRepository,
        },
        {
          provide: require('@oasis/db').PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    jest.clearAllMocks();
  });

  it('updates client profile fields when nullable optional inputs are sent as null', async () => {
    mockClientRepository.findById.mockResolvedValue({
      id: 'client-123',
      full_name: 'Browser Test Client',
      preferred_name: 'Old name',
      pronouns: 'she/her',
      address_line1: '1 Test Street',
      address_line2: 'Flat 1',
      city: 'London',
      postcode: 'E1 1AA',
      date_of_birth: null,
      preferred_language: 'English',
      communication_needs: 'Old needs',
      accessibility_adjustments: 'Old adjustments',
      representative_name: 'Old rep',
      representative_relationship: 'Daughter',
      representative_phone: '07111 111111',
      representative_email: 'old@example.com',
    });
    mockClientRepository.update.mockResolvedValue({
      id: 'client-123',
      full_name: 'Browser Test Client',
      preferred_name: 'B Test',
      pronouns: 'they/them',
      address_line1: '1 Test Street',
      address_line2: null,
      city: 'London',
      postcode: 'E1 1AA',
      date_of_birth: new Date('1948-05-14T00:00:00.000Z'),
      preferred_language: 'English',
      communication_needs: 'Speak clearly.',
      accessibility_adjustments: 'Large text.',
      representative_name: 'Avery Test',
      representative_relationship: 'Niece',
      representative_phone: null,
      representative_email: null,
    });

    const result = await service.updateClient(
      {
        id: 'client-123',
        fullName: 'Browser Test Client',
        preferredName: 'B Test',
        pronouns: 'they/them',
        addressLine1: '1 Test Street',
        addressLine2: null as any,
        city: 'London',
        postcode: 'E1 1AA',
        dateOfBirth: '1948-05-14',
        preferredLanguage: 'English',
        communicationNeeds: 'Speak clearly.',
        accessibilityAdjustments: 'Large text.',
        representativeName: 'Avery Test',
        representativeRelationship: 'Niece',
        representativePhone: null as any,
        representativeEmail: null as any,
      },
      'admin-123',
    );

    expect(mockClientRepository.update).toHaveBeenCalledWith('client-123', {
      full_name: 'Browser Test Client',
      preferred_name: 'B Test',
      pronouns: 'they/them',
      address_line1: '1 Test Street',
      address_line2: null,
      city: 'London',
      postcode: 'E1 1AA',
      date_of_birth: new Date('1948-05-14'),
      preferred_language: 'English',
      communication_needs: 'Speak clearly.',
      accessibility_adjustments: 'Large text.',
      representative_name: 'Avery Test',
      representative_relationship: 'Niece',
      representative_phone: null,
      representative_email: null,
    });
    expect(result.representativePhone).toBeNull();
    expect(result.representativeEmail).toBeNull();
  });
});
