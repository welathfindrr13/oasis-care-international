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
import { FamilyInvitationService } from '../carebridge/family-invitation.service';
import { acquireClientCareRoomLifecycleLock } from '../carebridge/active-operational-care-room';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly prisma: PrismaService,
    private readonly familyInvitations: FamilyInvitationService,
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
    this.logger.log(`Archiving client: ${id}`);

    const result = await this.runAuditedTransaction(
      'deletion',
      async (tx) => {
        await acquireClientCareRoomLifecycleLock(tx, orgId, id);

        const existingClient = await tx.client.findFirst({
          where: { id, organization_id: orgId },
        });
        if (!existingClient) {
          throw new BaseHttpException(
            ErrorCode.CLIENT_NOT_FOUND,
            'Client not found',
            HttpStatus.NOT_FOUND,
          );
        }
        if (existingClient.deleted_at) {
          return {
            deletedClient: existingClient,
            cleanupInvitationIds: [] as string[],
          };
        }

        const deletedAt = new Date();
        const rooms = await tx.careRoom.findMany({
          where: {
            organization_id: orgId,
            client_id: id,
            status: 'ACTIVE',
          },
          select: { id: true, status: true },
        });
        const roomIds = rooms.map((room) => room.id);
        const memberships = roomIds.length > 0
          ? await tx.careRoomMembership.findMany({
              where: {
                care_room_id: { in: roomIds },
                status: { in: ['INVITED', 'ACTIVE'] },
                revoked_at: null,
              },
              select: {
                id: true,
                care_room_id: true,
                status: true,
                organization_membership_invitation: {
                  select: { id: true, status: true },
                },
              },
            })
          : [];
        const membershipIds = memberships.map((membership) => membership.id);
        const cleanupInvitationIds = [
          ...new Set(
            memberships
              .map((membership) =>
                membership.organization_membership_invitation?.status === 'PENDING'
                  ? membership.organization_membership_invitation.id
                  : null,
              )
              .filter((invitationId): invitationId is string =>
                Boolean(invitationId),
              ),
          ),
        ];

        const transition = await tx.client.updateMany({
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
        if (transition.count === 0) {
          return {
            deletedClient: deleted,
            cleanupInvitationIds: [] as string[],
          };
        }

        await tx.visit.updateMany({
          where: { client_id: id, organization_id: orgId, deleted_at: null },
          data: { deleted_at: deletedAt },
        });
        if (roomIds.length > 0) {
          await tx.careRoom.updateMany({
            where: {
              id: { in: roomIds },
              organization_id: orgId,
              client_id: id,
              status: 'ACTIVE',
            },
            data: { status: 'ARCHIVED' },
          });
        }
        if (membershipIds.length > 0) {
          await tx.accessGrant.updateMany({
            where: {
              care_room_membership_id: { in: membershipIds },
              revoked_at: null,
            },
            data: { revoked_at: deletedAt },
          });
          await tx.careRoomMembership.updateMany({
            where: {
              id: { in: membershipIds },
              status: { in: ['INVITED', 'ACTIVE'] },
              revoked_at: null,
            },
            data: {
              status: 'REVOKED',
              revoked_at: deletedAt,
              revoked_by_user_id: userId || 'system',
            },
          });
        }
        if (cleanupInvitationIds.length > 0) {
          await tx.organizationMembershipInvitation.updateMany({
            where: {
              id: { in: cleanupInvitationIds },
              organization_id: orgId,
              intended_role: 'family',
              status: 'PENDING',
            },
            data: {
              status: 'REVOKED',
              revoked_at: deletedAt,
              external_cleanup_required: true,
              external_cleanup_error_code: null,
              external_cleanup_completed_at: null,
            },
          });
        }

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

        for (const room of rooms) {
          await tx.auditLog.create({
            data: {
              user_id: userId || 'system',
              organization_id: orgId,
              action: 'CAREBRIDGE_ROOM_ARCHIVED',
              resource_type: 'CareRoom',
              resource_id: room.id,
              old_values: sanitizeAuditMetadata({ status: room.status }),
              new_values: sanitizeAuditMetadata(
                {
                  status: 'ARCHIVED',
                  clientId: id,
                },
                { identifierSource: 'trusted' },
              ),
              timestamp: new Date(),
            },
          });
        }

        for (const membership of memberships) {
          await tx.auditLog.create({
            data: {
              user_id: userId || 'system',
              organization_id: orgId,
              action: 'FAMILY_ACCESS_REVOKED',
              resource_type: 'CareRoomMembership',
              resource_id: membership.id,
              old_values: sanitizeAuditMetadata({
                status: membership.status,
              }),
              new_values: sanitizeAuditMetadata(
                {
                  status: 'REVOKED',
                  careRoomId: membership.care_room_id,
                },
                { identifierSource: 'trusted' },
              ),
              timestamp: new Date(),
            },
          });
        }

        for (const invitationId of cleanupInvitationIds) {
          await tx.auditLog.create({
            data: {
              user_id: userId || 'system',
              organization_id: orgId,
              action: 'FAMILY_INVITATION_REVOKED',
              resource_type: 'OrganizationMembershipInvitation',
              resource_id: invitationId,
              old_values: sanitizeAuditMetadata({ status: 'PENDING' }),
              new_values: sanitizeAuditMetadata(
                {
                  status: 'REVOKED',
                  invitationId,
                },
                { identifierSource: 'trusted' },
              ),
              timestamp: new Date(),
            },
          });
        }

        return {
          deletedClient: deleted,
          cleanupInvitationIds,
        };
      },
    );

    await this.familyInvitations.reconcileArchivedClientInvitationCleanup(
      result.cleanupInvitationIds,
      orgId,
    );

    return this.mapClientToDTO(result.deletedClient);
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
