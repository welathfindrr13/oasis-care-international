import { Injectable } from '@nestjs/common';
import { PrismaService, Visit, VisitTask, Prisma, VisitStatus } from '@oasis/db';

@Injectable()
export class VisitRepository {
  constructor(private readonly prisma: PrismaService) {}

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
