import { Injectable, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { ClientRepository } from './client.repository';
import { ClientDTO, ClientPaginatedResponse } from './dto/client.dto';
import { CreateClientInput } from './dto/create-client.input';
import { UpdateClientInput } from './dto/update-client.input';
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
      preferred_name: input.preferredName?.trim() || undefined,
      pronouns: input.pronouns?.trim() || undefined,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2,
      city: input.city,
      postcode: input.postcode,
      date_of_birth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      preferred_language: input.preferredLanguage?.trim() || undefined,
      communication_needs: input.communicationNeeds?.trim() || undefined,
      accessibility_adjustments: input.accessibilityAdjustments?.trim() || undefined,
      representative_name: input.representativeName?.trim() || undefined,
      representative_relationship: input.representativeRelationship?.trim() || undefined,
      representative_phone: input.representativePhone?.trim() || undefined,
      representative_email: input.representativeEmail?.trim() || undefined,
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

  async updateClient(input: UpdateClientInput, userId?: string): Promise<ClientDTO> {
    const existingClient = await this.clientRepository.findById(input.id);

    if (!existingClient) {
      throw new BaseHttpException(
        ErrorCode.CLIENT_NOT_FOUND,
        'Client not found',
        HttpStatus.NOT_FOUND
      );
    }

    const updateData: Record<string, unknown> = {};

    if (typeof input.fullName === 'string') updateData.full_name = input.fullName.trim();
    if (input.preferredName !== undefined) updateData.preferred_name = this.normalizeOptionalText(input.preferredName);
    if (input.pronouns !== undefined) updateData.pronouns = this.normalizeOptionalText(input.pronouns);
    if (typeof input.addressLine1 === 'string') updateData.address_line1 = input.addressLine1.trim();
    if (input.addressLine2 !== undefined) updateData.address_line2 = this.normalizeOptionalText(input.addressLine2);
    if (typeof input.city === 'string') updateData.city = input.city.trim();
    if (typeof input.postcode === 'string') updateData.postcode = input.postcode.trim().toUpperCase();
    if (input.dateOfBirth !== undefined) updateData.date_of_birth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
    if (input.preferredLanguage !== undefined) updateData.preferred_language = this.normalizeOptionalText(input.preferredLanguage);
    if (input.communicationNeeds !== undefined) updateData.communication_needs = this.normalizeOptionalText(input.communicationNeeds);
    if (input.accessibilityAdjustments !== undefined) updateData.accessibility_adjustments = this.normalizeOptionalText(input.accessibilityAdjustments);
    if (input.representativeName !== undefined) updateData.representative_name = this.normalizeOptionalText(input.representativeName);
    if (input.representativeRelationship !== undefined) updateData.representative_relationship = this.normalizeOptionalText(input.representativeRelationship);
    if (input.representativePhone !== undefined) updateData.representative_phone = this.normalizeOptionalText(input.representativePhone);
    if (input.representativeEmail !== undefined) updateData.representative_email = this.normalizeOptionalText(input.representativeEmail);

    const updatedClient = await this.clientRepository.update(input.id, updateData);

    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: userId || 'system',
          action: 'UPDATE_CLIENT_PROFILE',
          resource_type: 'client',
          resource_id: updatedClient.id,
          old_values: {
            fullName: '[REDACTED]',
            preferredName: existingClient.preferred_name || null,
            preferredLanguage: existingClient.preferred_language || null,
            communicationNeeds: existingClient.communication_needs ? '[REDACTED]' : null,
            accessibilityAdjustments: existingClient.accessibility_adjustments ? '[REDACTED]' : null,
            representativeName: existingClient.representative_name ? '[REDACTED]' : null,
          },
          new_values: {
            fullName: '[REDACTED]',
            preferredName: updatedClient.preferred_name || null,
            preferredLanguage: updatedClient.preferred_language || null,
            communicationNeeds: updatedClient.communication_needs ? '[REDACTED]' : null,
            accessibilityAdjustments: updatedClient.accessibility_adjustments ? '[REDACTED]' : null,
            representativeName: updatedClient.representative_name ? '[REDACTED]' : null,
          },
          timestamp: new Date(),
        },
      });
    } catch (auditError) {
      this.logger.warn('Failed to write audit log for client update', auditError);
    }

    return this.mapClientToDTO(updatedClient);
  }

  private mapClientToDTO(client: any): ClientDTO {
    return {
      id: client.id,
      fullName: client.full_name,
      preferredName: client.preferred_name,
      pronouns: client.pronouns,
      addressLine1: client.address_line1,
      addressLine2: client.address_line2,
      city: client.city,
      postcode: client.postcode,
      dateOfBirth: client.date_of_birth,
      preferredLanguage: client.preferred_language,
      communicationNeeds: client.communication_needs,
      accessibilityAdjustments: client.accessibility_adjustments,
      representativeName: client.representative_name,
      representativeRelationship: client.representative_relationship,
      representativePhone: client.representative_phone,
      representativeEmail: client.representative_email,
    };
  }

  private normalizeOptionalText(value?: string | null): string | null {
    return value?.trim() || null;
  }
}
