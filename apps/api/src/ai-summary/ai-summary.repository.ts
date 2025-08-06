import { Injectable } from '@nestjs/common';
import { PrismaService, HealthSummary, Prisma } from '@oasis/db';

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

  async findById(id: string): Promise<HealthSummary | null> {
    return this.prisma.healthSummary.findUnique({
      where: { id },
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
  }): Promise<{ items: HealthSummary[]; total: number }> {
    const where = args.where || {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.healthSummary.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy || { generated_at: 'desc' },
        include: {
          client: true,
          approver: true,
        },
      }),
      this.prisma.healthSummary.count({ where }),
    ]);

    return { items, total };
  }

  async findPending(args?: {
    skip?: number;
    take?: number;
  }): Promise<{ items: HealthSummary[]; total: number }> {
    const where: Prisma.HealthSummaryWhereInput = {
      approved_by: null,
      expires_at: { gt: new Date() },
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
    periodEnd: Date
  ): Promise<HealthSummary | null> {
    return this.prisma.healthSummary.findFirst({
      where: {
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
      },
      include: {
        client: true,
        approver: true,
      },
      orderBy: { generated_at: 'desc' },
    });
  }

  async findCurrentWeekSummary(clientId: string): Promise<HealthSummary | null> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of current week
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // End of current week
    weekEnd.setHours(23, 59, 59, 999);

    return this.prisma.healthSummary.findFirst({
      where: {
        client_id: clientId,
        period_start: { gte: weekStart },
        period_end: { lte: weekEnd },
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

  async checkOrganizationAIEnabled(clientId: string): Promise<boolean> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        organization: {
          select: { ai_summary_enabled: true },
        },
      },
    });

    return client?.organization?.ai_summary_enabled ?? false;
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
