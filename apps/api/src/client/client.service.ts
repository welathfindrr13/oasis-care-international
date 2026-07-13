import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { Prisma, PrismaService } from '@oasis/db';
import { ClientRepository } from './client.repository';
import { ClientDTO, ClientPaginatedResponse } from './dto/client.dto';
import { CreateClientInput } from './dto/create-client.input';
import { UpdateClientInput } from './dto/update-client.input';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import {
  extractSafeAuditErrorMetadata,
  sanitizeAuditMetadata,
} from '../common/audit/audit-metadata.policy';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findClients(
    filter: { skip?: number; take?: number; search?: string },
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<ClientPaginatedResponse> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.logger.log(`Finding clients with filter`, { filter });

    // Build where clause with optional search
    const where: any = {};

    if (filter.search) {
      where.OR = [
        { full_name: { contains: filter.search, mode: 'insensitive' } },
        { city: { contains: filter.search, mode: 'insensitive' } },
        { postcode: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Carers should only see clients they have at least one assigned visit for.
    if (this.normalizeRole(userRole) === 'carer') {
      where.visits = {
        some: {
          organization_id: orgId,
          carer_id: userId,
          deleted_at: null,
        },
      };
    }

    const result = await this.clientRepository.findMany({
      where,
      skip: filter.skip,
      take: filter.take || 20,
    }, orgId);

    return {
      items: result.items.map(client => this.mapClientToDTO(client)),
      total: result.total,
    };
  }

  async findClientById(
    id: string,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<ClientDTO> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.logger.log(`Finding client by ID: ${id}`);

    const normalizedRole = this.normalizeRole(userRole);
    const client = normalizedRole === 'carer'
      ? await this.prisma.client.findFirst({
        where: this.prisma.whereNotDeleted({
          id,
          organization_id: orgId,
          visits: {
            some: {
              organization_id: orgId,
              carer_id: userId,
              deleted_at: null,
            },
          },
        }),
      })
      : await this.clientRepository.findById(id, orgId);

    if (!client) {
      throw new BaseHttpException(
        ErrorCode.CLIENT_NOT_FOUND,
        'Client not found',
        HttpStatus.NOT_FOUND
      );
    }

    return this.mapClientToDTO(client);
  }

  async createClient(input: CreateClientInput, userId?: string, organizationId?: string): Promise<ClientDTO> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.logger.log(`Creating client: [NAME REDACTED]`); // GDPR: Don't log PII

    const client = await this.runAuditedTransaction(
      'creation',
      async (tx) => {
        const created = await this.clientRepository.create({
          organization_id: orgId,
          full_name: input.fullName,
          address_line1: input.addressLine1,
          address_line2: input.addressLine2,
          city: input.city,
          postcode: input.postcode,
        }, tx);

        // Audit only reviewed identifiers; do not duplicate client PII.
        await tx.auditLog.create({
          data: {
            user_id: userId || 'system',
            organization_id: orgId,
            action: 'CREATE_CLIENT',
            resource_type: 'client',
            resource_id: created.id,
            old_values: {},
            new_values: sanitizeAuditMetadata(
              {
                id: created.id,
                fullName: created.full_name,
                city: created.city,
                postcode: created.postcode,
              },
              { identifierSource: 'trusted' },
            ),
            timestamp: new Date(),
          },
        });
        return created;
      },
    );

    this.logger.log(`Client created with ID: ${client.id}`);
    return this.mapClientToDTO(client);
  }

  async updateClient(id: string, input: UpdateClientInput, userId?: string, organizationId?: string): Promise<ClientDTO> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.logger.log(`Updating client: ${id}`);

    const existingClient = await this.clientRepository.findById(id, orgId);
    if (!existingClient) {
      throw new BaseHttpException(
        ErrorCode.CLIENT_NOT_FOUND,
        'Client not found',
        HttpStatus.NOT_FOUND
      );
    }

    const client = await this.runAuditedTransaction(
      'update',
      async (tx) => {
        const updated = await this.clientRepository.update(id, orgId, {
          full_name: input.fullName,
          address_line1: input.addressLine1,
          address_line2: input.addressLine2 ?? null,
          city: input.city,
          postcode: input.postcode,
        }, tx);

        await tx.auditLog.create({
          data: {
            user_id: userId || 'system',
            organization_id: orgId,
            action: 'UPDATE_CLIENT',
            resource_type: 'client',
            resource_id: updated.id,
            old_values: sanitizeAuditMetadata(
              {
                id: existingClient.id,
                fullName: existingClient.full_name,
                city: existingClient.city,
                postcode: existingClient.postcode,
              },
              { identifierSource: 'trusted' },
            ),
            new_values: sanitizeAuditMetadata(
              {
                id: updated.id,
                fullName: updated.full_name,
                city: updated.city,
                postcode: updated.postcode,
              },
              { identifierSource: 'trusted' },
            ),
            timestamp: new Date(),
          },
        });
        return updated;
      },
    );

    return this.mapClientToDTO(client);
  }

  async deleteClient(id: string, userId?: string, organizationId?: string): Promise<ClientDTO> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.logger.log(`Soft deleting client: ${id}`);

    const existingClient = await this.clientRepository.findById(id, orgId);
    if (!existingClient) {
      throw new BaseHttpException(
        ErrorCode.CLIENT_NOT_FOUND,
        'Client not found',
        HttpStatus.NOT_FOUND
      );
    }

    // Soft-delete related visits as well, so scheduled visits don't linger after cleanup.
    const deletedClient = await this.runAuditedTransaction(
      'deletion',
      async (tx) => {
        const deletedAt = new Date();
        await tx.visit.updateMany({
          where: { client_id: id, organization_id: orgId, deleted_at: null },
          data: { deleted_at: deletedAt },
        });

        await tx.client.updateMany({
          where: { id, organization_id: orgId, deleted_at: null },
          data: { deleted_at: deletedAt },
        });

        const deleted = await tx.client.findFirst({
          where: { id, organization_id: orgId },
        });
        if (!deleted) {
          throw new BaseHttpException(
            ErrorCode.CLIENT_NOT_FOUND,
            'Client not found',
            HttpStatus.NOT_FOUND,
          );
        }

        // Audit only reviewed identifiers; do not duplicate client PII.
        await tx.auditLog.create({
          data: {
            user_id: userId || 'system',
            organization_id: orgId,
            action: 'DELETE_CLIENT',
            resource_type: 'client',
            resource_id: id,
            old_values: sanitizeAuditMetadata(
              {
                id,
                fullName: existingClient.full_name,
                city: existingClient.city,
                postcode: existingClient.postcode,
              },
              { identifierSource: 'trusted' },
            ),
            new_values: sanitizeAuditMetadata(
              {
                id,
                deletedAt: deletedAt.toISOString(),
              },
              { identifierSource: 'trusted' },
            ),
            timestamp: new Date(),
          },
        });
        return deleted;
      },
    );

    return this.mapClientToDTO(deletedClient);
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

  private normalizeRole(userRole: string): string {
    return (userRole || '').toLowerCase().trim();
  }

  private async runAuditedTransaction<T>(
    operation: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(work);
    } catch (error) {
      this.logger.warn(
        `Audited client ${operation} failed`,
        extractSafeAuditErrorMetadata(error),
      );
      throw error;
    }
  }

  private async requireOrganizationId(organizationId?: string): Promise<string> {
    const orgId = (organizationId || '').trim();
    if (orgId) {
      return orgId;
    }

    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
      'Organization context is required for this request',
      HttpStatus.FORBIDDEN,
    );
  }
}
