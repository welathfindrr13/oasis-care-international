import { Injectable } from '@nestjs/common';
import { CareLog, Prisma, PrismaService } from '@oasis/db';
import { assertTenantOwnershipForSensitiveWrite } from '../common/tenant/tenant-ownership';

@Injectable()
export class CareLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.CareLogCreateInput): Promise<CareLog> {
    assertTenantOwnershipForSensitiveWrite('CareLog', data as any);
    return this.prisma.careLog.create({ data });
  }

  async findMany(args: {
    where?: Prisma.CareLogWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.CareLogOrderByWithRelationInput;
  }): Promise<{ items: CareLog[]; total: number }> {
    const where = this.prisma.whereNotDeleted(args.where || {});

    const [items, total] = await this.prisma.$transaction([
      this.prisma.careLog.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy || { occurred_at: 'desc' },
      }),
      this.prisma.careLog.count({ where }),
    ]);

    return { items, total };
  }
}
