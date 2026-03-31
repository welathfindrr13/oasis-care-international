import { Injectable, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { ClientRepository } from './client.repository';
import { ClientDTO, ClientPaginatedResponse } from './dto/client.dto';
import { CreateClientInput } from './dto/create-client.input';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findClients(filter: { skip?: number; take?: number; search?: string }): Promise<ClientPaginatedResponse> {
    this.logger.log(`Finding clients with filter`, { filter });

    // Build where clause with optional search
    // Note: Single-tenant for now; add organization_id filter when multi-tenant
    const where: any = {};
    
    if (filter.search) {
      where.OR = [
        { full_name: { contains: filter.search, mode: 'insensitive' } },
        { city: { contains: filter.search, mode: 'insensitive' } },
        { postcode: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const result = await this.clientRepository.findMany({
      where,
      skip: filter.skip,
      take: filter.take || 20,
    });

    return {
      items: result.items.map(client => this.mapClientToDTO(client)),
      total: result.total,
    };
  }

  async findClientById(id: string): Promise<ClientDTO> {
    this.logger.log(`Finding client by ID: ${id}`);

    const client = await this.clientRepository.findById(id);

    if (!client) {
      throw new BaseHttpException(
        ErrorCode.CLIENT_NOT_FOUND,
        'Client not found',
        HttpStatus.NOT_FOUND
      );
    }

    return this.mapClientToDTO(client);
  }

  async createClient(input: CreateClientInput, userId?: string): Promise<ClientDTO> {
    this.logger.log(`Creating client: [NAME REDACTED]`); // GDPR: Don't log PII

    if (!input.privacyNoticeAcknowledged) {
      throw new BadRequestException('A privacy notice acknowledgement is required to create a client.');
    }

    const client = await this.clientRepository.create({
      full_name: input.fullName,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2,
      city: input.city,
      postcode: input.postcode,
    });

    // GDPR: Audit log the client creation with PII masked
    try {
      const privacyNoticeVersion = input.privacyNoticeVersion?.trim() || 'pilot-v1';

      await this.prisma.auditLog.create({
        data: {
          user_id: userId || 'system',
          action: 'ACKNOWLEDGE_CLIENT_DATA_PROCESSING',
          resource_type: 'client_intake',
          resource_id: client.id,
          old_values: {},
          new_values: {
            clientId: client.id,
            lawfulBasis: 'health_or_social_care_delivery',
            privacyNoticeAcknowledged: true,
            privacyNoticeVersion,
            acknowledgementSource: 'client_create_form',
          },
          timestamp: new Date(),
        },
      });

      await this.prisma.auditLog.create({
        data: {
          user_id: userId || 'system',
          action: 'CREATE_CLIENT',
          resource_type: 'client',
          resource_id: client.id,
          old_values: {},
          new_values: {
            id: client.id,
            fullName: '[REDACTED]',
            city: client.city,
            postcode: '[REDACTED]',
            lawfulBasis: 'health_or_social_care_delivery',
            privacyNoticeVersion,
          },
          timestamp: new Date(),
        },
      });
    } catch (auditError) {
      this.logger.warn('Failed to write audit log for client creation', auditError);
    }

    this.logger.log(`Client created with ID: ${client.id}`);
    return this.mapClientToDTO(client);
  }

  private mapClientToDTO(client: any): ClientDTO {
    return {
      id: client.id,
      fullName: client.full_name,
      addressLine1: client.address_line1,
      addressLine2: client.address_line2,
      city: client.city,
      postcode: client.postcode,
    };
  }
}
