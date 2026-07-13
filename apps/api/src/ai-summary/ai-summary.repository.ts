import { Injectable } from '@nestjs/common';
import { PrismaService, HealthSummary, Prisma } from '@oasis/db';
import { organizationWeekUtcRange } from '@oasis/time';

@Injectable()
export class AiSummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.HealthSummaryCreateInput): Promise<HealthSummary> {
    return this.prisma.healthSummary.create({
      data,
      include: {
        client: true,
        approver: true,
      },
    });
  }

  async findById(id: string, organizationId: string): Promise<HealthSummary | null> {
    return this.prisma.healthSummary.findFirst({
      where: {
        id,
        client: {
          organization_id: organizationId,
          deleted_at: null,
        },
      },
      include: {
        client: true,
        approver: true,
      },
    });
  }

  async findMany(args: {
    where?: Prisma.HealthSummaryWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.HealthSummaryOrderByWithRelationInput;
  }, organizationId: string): Promise<{ items: HealthSummary[]; total: number }> {
    const where = args.where || {};
    const scopedWhere: Prisma.HealthSummaryWhereInput = {
      AND: [
        where,
        {
          client: {
            organization_id: organizationId,
            deleted_at: null,
          },
        },
      ],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.healthSummary.findMany({
        where: scopedWhere,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy || { generated_at: 'desc' },
        include: {
          client: true,
          approver: true,
        },
      }),
      this.prisma.healthSummary.count({ where: scopedWhere }),
    ]);

    return { items, total };
  }

  async findPending(args?: {
    skip?: number;
    take?: number;
  }, organizationId?: string): Promise<{ items: HealthSummary[]; total: number }> {
    const where: Prisma.HealthSummaryWhereInput = {
      approved_by: null,
      expires_at: { gt: new Date() },
      ...(organizationId
        ? {
            client: {
              organization_id: organizationId,
              deleted_at: null,
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.healthSummary.findMany({
        where,
        skip: args?.skip,
        take: args?.take,
        orderBy: { generated_at: 'desc' },
        include: {
          client: true,
          approver: true,
        },
      }),
      this.prisma.healthSummary.count({ where }),
    ]);

    return { items, total };
  }

  async findByClientAndPeriod(
    clientId: string,
    periodStart: Date,
    periodEnd: Date,
    organizationId: string,
  ): Promise<HealthSummary | null> {
    return this.prisma.healthSummary.findFirst({
      where: {
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
        client: {
          organization_id: organizationId,
          deleted_at: null,
        },
      },
      include: {
        client: true,
        approver: true,
      },
      orderBy: { generated_at: 'desc' },
    });
  }

  async findCurrentWeekSummary(clientId: string, organizationId: string): Promise<HealthSummary | null> {
    const week = organizationWeekUtcRange(new Date(), organizationId);
    const weekEnd = new Date(week.end.getTime() - 1);

    return this.prisma.healthSummary.findFirst({
      where: {
        client_id: clientId,
        period_start: { gte: week.start },
        period_end: { lte: weekEnd },
        client: {
          organization_id: organizationId,
          deleted_at: null,
        },
      },
      include: {
        client: true,
        approver: true,
      },
      orderBy: { generated_at: 'desc' },
    });
  }

  async update(
    id: string,
    data: Prisma.HealthSummaryUpdateInput
  ): Promise<HealthSummary> {
    return this.prisma.healthSummary.update({
      where: { id },
      data,
      include: {
        client: true,
        approver: true,
      },
    });
  }

  async approve(
    id: string,
    approvedBy: string,
    feedback?: string
  ): Promise<HealthSummary> {
    return this.prisma.healthSummary.update({
      where: { id },
      data: {
        approved_by: approvedBy,
        approved_at: new Date(),
        feedback: feedback || 'approved',
        updated_at: new Date(),
      },
      include: {
        client: true,
        approver: true,
      },
    });
  }

  async checkOrganizationAIEnabled(clientId: string, organizationId: string): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: this.prisma.whereNotDeleted({
        id: clientId,
        organization_id: organizationId,
      }),
      include: {
        organization: {
          select: { ai_summary_enabled: true },
        },
      },
    });

    return client?.organization?.ai_summary_enabled ?? false;
  }

  async setOrganizationAIEnabledByClientId(
    clientId: string,
    enabled: boolean,
    organizationId: string,
  ): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: this.prisma.whereNotDeleted({
        id: clientId,
        organization_id: organizationId,
      }),
      select: { organization_id: true },
    });

    if (!client?.organization_id) {
      return false;
    }

    await this.prisma.organization.update({
      where: { id: client.organization_id },
      data: { ai_summary_enabled: enabled },
    });

    return true;
  }

  async findExpiredSummaries(): Promise<HealthSummary[]> {
    return this.prisma.healthSummary.findMany({
      where: {
        expires_at: { lt: new Date() },
        approved_by: null,
      },
      include: {
        client: true,
      },
    });
  }
}
