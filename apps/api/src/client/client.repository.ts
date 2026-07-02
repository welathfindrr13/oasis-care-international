import { Injectable } from '@nestjs/common';
import { PrismaService, Client, Prisma } from '@oasis/db';
import { assertTenantIdForSensitiveWrite } from '../common/tenant/tenant-ownership';

@Injectable()
export class ClientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, organizationId: string): Promise<Client | null> {
    return this.prisma.client.findFirst({
      where: this.prisma.whereNotDeleted({ id, organization_id: organizationId }),
    });
  }

  async findMany(args: {
    where?: Prisma.ClientWhereInput;
    skip?: number;
    take?: number;
  }, organizationId: string): Promise<{ items: Client[]; total: number }> {
    const where = this.prisma.whereNotDeleted({
      ...args.where,
      organization_id: organizationId,
    });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { full_name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { items, total };
  }

  async create(data: {
    organization_id: string;
    full_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    postcode: string;
  }): Promise<Client> {
    assertTenantIdForSensitiveWrite('Client', data.organization_id);
    return this.prisma.client.create({
      data,
    });
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      full_name: string;
      address_line1: string;
      address_line2?: string | null;
      city: string;
      postcode: string;
    }
  ): Promise<Client> {
    const updated = await this.prisma.client.updateMany({
      where: this.prisma.whereNotDeleted({ id, organization_id: organizationId }),
      data,
    });
    if (updated.count === 0) {
      throw new Error('Client not found in organization');
    }
    return this.findById(id, organizationId) as Promise<Client>;
  }

  async softDelete(id: string, organizationId: string): Promise<Client> {
    const deleted = await this.prisma.client.updateMany({
      where: this.prisma.whereNotDeleted({ id, organization_id: organizationId }),
      data: { deleted_at: new Date() },
    });
    if (deleted.count === 0) {
      throw new Error('Client not found in organization');
    }
    return this.findById(id, organizationId) as Promise<Client>;
  }
}
