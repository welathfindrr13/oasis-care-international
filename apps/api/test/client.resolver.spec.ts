import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientResolver } from '../src/client/client.resolver';
import { ClientService } from '../src/client/client.service';

describe('ClientResolver', () => {
  let resolver: ClientResolver;
  let service: ClientService;

  const mockClientService = {
    findClients: jest.fn(),
    findClientById: jest.fn(),
    createClient: jest.fn(),
    updateClient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientResolver,
        {
          provide: ClientService,
          useValue: mockClientService,
        },
      ],
    }).compile();

    resolver = module.get<ClientResolver>(ClientResolver);
    service = module.get<ClientService>(ClientService);
    jest.clearAllMocks();
  });

  it('marks clients query as admin-only', () => {
    expect(Reflect.getMetadata('roles', resolver.clients)).toEqual(['admin']);
  });

  it('marks client query as admin-only', () => {
    expect(Reflect.getMetadata('roles', resolver.client)).toEqual(['admin']);
  });

  it('marks createClient mutation as admin-only', () => {
    expect(Reflect.getMetadata('roles', resolver.createClient)).toEqual(['admin']);
  });

  it('passes the authenticated user id into createClient for audit logging', async () => {
    const input = {
      fullName: 'Margaret Thompson',
      addressLine1: '15 Oak Street',
      addressLine2: 'Flat 2B',
      city: 'London',
      postcode: 'SW1A 1AA',
      privacyNoticeAcknowledged: true,
      privacyNoticeVersion: 'pilot-v1',
    };
    const ctx = {
      req: {
        user: {
          sub: 'admin-123',
        },
      },
    };
    const createdClient = { id: 'client-123', ...input };
    mockClientService.createClient.mockResolvedValue(createdClient);

    const result = await resolver.createClient(input, ctx);

    expect(service.createClient).toHaveBeenCalledWith(input, 'admin-123');
    expect(result).toEqual(createdClient);
  });

  it('marks updateClient mutation as admin-only', () => {
    expect(Reflect.getMetadata('roles', resolver.updateClient)).toEqual(['admin']);
  });

  it('passes the authenticated user id into updateClient for audit logging', async () => {
    const input = {
      id: 'client-123',
      preferredName: 'Maggie',
      communicationNeeds: 'Speak slowly and face the client.',
    };
    const ctx = {
      req: {
        user: {
          sub: 'admin-123',
        },
      },
    };
    const updatedClient = { fullName: 'Margaret Thompson', ...input };
    mockClientService.updateClient.mockResolvedValue(updatedClient);

    const result = await resolver.updateClient(input as any, ctx);

    expect(service.updateClient).toHaveBeenCalledWith(input, 'admin-123');
    expect(result).toEqual(updatedClient);
  });
});
