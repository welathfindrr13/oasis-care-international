import { Injectable } from '@nestjs/common';
import { PrismaService, Visit, VisitTask, Prisma, VisitStatus, Carer } from '@oasis/db';

type CarerDirectoryRecord = Carer & {
  upcomingVisitsCount: number;
  completedTodayCount: number;
};

@Injectable()
export class VisitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCarers(activeOnly = true, search?: string): Promise<CarerDirectoryRecord[]> {
    const where: Prisma.CarerWhereInput = this.prisma.whereNotDeleted(
      activeOnly ? { is_active: true } : {}
    );

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      where.OR = [
        { first_name: { contains: trimmedSearch, mode: 'insensitive' } },
        { last_name: { contains: trimmedSearch, mode: 'insensitive' } },
        { email: { contains: trimmedSearch, mode: 'insensitive' } },
      ];
    }

    const carers = await this.prisma.carer.findMany({
      where,
      orderBy: [
        { first_name: 'asc' },
        { last_name: 'asc' },
      ],
    });

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    return Promise.all(
      carers.map(async (carer) => {
        const [upcomingVisitsCount, completedTodayCount] = await this.prisma.$transaction([
          this.prisma.visit.count({
            where: this.prisma.whereNotDeleted({
              carer_id: carer.id,
              status: VisitStatus.SCHEDULED,
              scheduled_start: { gte: now },
            }),
          }),
          this.prisma.visit.count({
            where: this.prisma.whereNotDeleted({
              carer_id: carer.id,
              status: VisitStatus.COMPLETED,
              actual_end: {
                gte: startOfToday,
                lte: endOfToday,
              },
            }),
          }),
        ]);

        return {
          ...carer,
          upcomingVisitsCount,
          completedTodayCount,
        };
      })
    );
  }

  async create(data: Prisma.VisitCreateInput): Promise<Visit> {
    return this.prisma.visit.create({
      data,
      include: {
        carer: true,
        client: true,
        tasks: true,
      },
    });
  }

  async findById(id: string): Promise<Visit | null> {
    return this.prisma.visit.findFirst({
      where: this.prisma.whereNotDeleted({ id }),
      include: {
        carer: true,
        client: true,
        tasks: {
          where: { deleted_at: null },
        },
      },
    });
  }

  async findMany(args: {
    where?: Prisma.VisitWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.VisitOrderByWithRelationInput;
  }): Promise<{ items: Visit[]; total: number }> {
    const where = this.prisma.whereNotDeleted(args.where);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy || { scheduled_start: 'desc' },
        include: {
          carer: true,
          client: true,
          tasks: {
            where: { deleted_at: null },
          },
        },
      }),
      this.prisma.visit.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.VisitUpdateInput
  ): Promise<Visit> {
    return this.prisma.visit.update({
      where: { id },
      data,
      include: {
        carer: true,
        client: true,
        tasks: {
          where: { deleted_at: null },
        },
      },
    });
  }

  async delete(id: string): Promise<Visit> {
    return this.prisma.visit.update({
      where: { id },
      data: { deleted_at: new Date() },
      include: {
        carer: true,
        client: true,
        tasks: true,
      },
    });
  }

  async findOverlappingVisits(
    carerId: string,
    scheduledStart: Date,
    scheduledEnd: Date,
    excludeVisitId?: string
  ): Promise<Visit[]> {
    const where: Prisma.VisitWhereInput = {
      carer_id: carerId,
      deleted_at: null,
      status: { not: VisitStatus.CANCELLED },
      AND: [
        {
          scheduled_start: { lt: scheduledEnd },
        },
        {
          scheduled_end: { gt: scheduledStart },
        },
      ],
    };

    if (excludeVisitId) {
      where.id = { not: excludeVisitId };
    }

    return this.prisma.visit.findMany({ where });
  }

  async createTask(
    visitId: string,
    data: Omit<Prisma.VisitTaskCreateInput, 'visit'>
  ): Promise<VisitTask> {
    return this.prisma.visitTask.create({
      data: {
        ...data,
        visit: { connect: { id: visitId } },
      },
    });
  }

  async updateTask(
    taskId: string,
    data: Prisma.VisitTaskUpdateInput
  ): Promise<VisitTask> {
    return this.prisma.visitTask.update({
      where: { id: taskId },
      data,
    });
  }

  async findTaskById(taskId: string): Promise<VisitTask | null> {
    return this.prisma.visitTask.findFirst({
      where: this.prisma.whereNotDeleted({ id: taskId }),
    });
  }
}
