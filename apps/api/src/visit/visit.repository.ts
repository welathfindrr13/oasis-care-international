import { Injectable } from "@nestjs/common";
import {
  PrismaService,
  Visit,
  VisitTask,
  Prisma,
  VisitStatus,
  MedicationStatus,
} from "@oasis/db";
import { VISIT_TASK_OUTCOME_PREFIX } from "./visit.constants";
import { assertTenantOwnershipForSensitiveWrite } from "../common/tenant/tenant-ownership";

@Injectable()
export class VisitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.VisitCreateInput): Promise<Visit> {
    assertTenantOwnershipForSensitiveWrite("Visit", data as any);
    return this.prisma.visit.create({
      data,
      include: {
        carer: true,
        client: true,
        tasks: true,
      },
    });
  }

  async createIfAssignable(
    data: Prisma.VisitCreateInput,
    input: {
      organizationId: string;
      carerId: string;
      clientId: string;
      scheduledStart: Date;
      scheduledEnd: Date;
    },
  ): Promise<
    | { status: "CREATED"; visit: Visit }
    | { status: "INVALID_TENANT_RESOURCE" }
    | { status: "OVERLAP" }
  > {
    assertTenantOwnershipForSensitiveWrite("Visit", data as any);
    return (this.prisma as any).$transaction(
      async (tx: any) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.carerIdentityLockKey(input.organizationId, input.carerId)}, 0))`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.assignmentLockKey(input.organizationId, input.carerId)}, 0))`;
        const [carer, client] = await Promise.all([
          tx.carer.findFirst({
            where: {
              id: input.carerId,
              organization_id: input.organizationId,
              is_active: true,
              deleted_at: null,
              organization_memberships: {
                some: {
                  organization_id: input.organizationId,
                  identity_provider: this.identityProvider(),
                  auth_subject: { not: "" },
                  role: { in: ["carer", "staff"] },
                  status: "ACTIVE",
                  revoked_at: null,
                },
              },
            },
            select: { id: true },
          }),
          tx.client.findFirst({
            where: {
              id: input.clientId,
              organization_id: input.organizationId,
              deleted_at: null,
            },
            select: { id: true },
          }),
        ]);
        if (!carer || !client) return { status: "INVALID_TENANT_RESOURCE" };
        const overlap = await tx.visit.findFirst({
          where: {
            organization_id: input.organizationId,
            carer_id: input.carerId,
            deleted_at: null,
            status: { not: VisitStatus.CANCELLED },
            scheduled_start: { lt: input.scheduledEnd },
            scheduled_end: { gt: input.scheduledStart },
          },
          select: { id: true },
        });
        if (overlap) return { status: "OVERLAP" };
        const visit = await tx.visit.create({
          data,
          include: { carer: true, client: true, tasks: true },
        });
        return { status: "CREATED", visit };
      },
      // READ COMMITTED is intentional: after waiting on the lifecycle locks,
      // validation must observe a deactivation that committed while we waited.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async findById(id: string, organizationId: string): Promise<Visit | null> {
    return this.prisma.visit.findFirst({
      where: this.prisma.whereNotDeleted({
        id,
        organization_id: organizationId,
      }),
      include: {
        carer: true,
        client: true,
        tasks: {
          where: { deleted_at: null },
        },
      },
    });
  }

  async findMany(
    args: {
      where?: Prisma.VisitWhereInput;
      skip?: number;
      take?: number;
      orderBy?: Prisma.VisitOrderByWithRelationInput;
    },
    organizationId: string,
  ): Promise<{ items: Visit[]; total: number }> {
    const where = this.prisma.whereNotDeleted({
      ...args.where,
      organization_id: organizationId,
    });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy || { scheduled_start: "desc" },
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
    data: Prisma.VisitUpdateInput,
    organizationId: string,
  ): Promise<Visit> {
    const updated = await this.prisma.visit.updateMany({
      where: this.prisma.whereNotDeleted({
        id,
        organization_id: organizationId,
      }),
      data,
    });
    if (updated.count === 0) {
      throw new Error("Visit not found in organization");
    }
    return this.findById(id, organizationId) as Promise<Visit>;
  }

  async delete(id: string, organizationId: string): Promise<Visit> {
    const deleted = await this.prisma.visit.updateMany({
      where: this.prisma.whereNotDeleted({
        id,
        organization_id: organizationId,
      }),
      data: { deleted_at: new Date() },
    });
    if (deleted.count === 0) {
      throw new Error("Visit not found in organization");
    }
    return this.prisma.visit.findFirst({
      where: { id, organization_id: organizationId },
      include: {
        carer: true,
        client: true,
        tasks: {
          where: { deleted_at: null },
        },
      },
    }) as Promise<Visit>;
  }

  async findOverlappingVisits(
    carerId: string,
    scheduledStart: Date,
    scheduledEnd: Date,
    organizationId: string,
    excludeVisitId?: string,
  ): Promise<Visit[]> {
    const where: Prisma.VisitWhereInput = {
      organization_id: organizationId,
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
    data: Omit<Prisma.VisitTaskCreateInput, "visit">,
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
    data: Prisma.VisitTaskUpdateInput,
    organizationId: string,
  ): Promise<VisitTask> {
    const updated = await this.prisma.visitTask.updateMany({
      where: {
        id: taskId,
        deleted_at: null,
        visit: {
          organization_id: organizationId,
          deleted_at: null,
        },
      },
      data,
    });
    if (updated.count === 0) {
      throw new Error("Task not found in organization");
    }
    return this.findTaskById(taskId, organizationId) as Promise<VisitTask>;
  }

  async findTaskById(
    taskId: string,
    organizationId: string,
  ): Promise<VisitTask | null> {
    return this.prisma.visitTask.findFirst({
      where: this.prisma.whereNotDeleted({
        id: taskId,
        visit: {
          organization_id: organizationId,
          deleted_at: null,
        },
      }),
    });
  }

  async countTaskOutcomeEntriesForVisit(
    visitId: string,
    organizationId: string,
  ): Promise<number> {
    return this.prisma.visitTask.count({
      where: {
        visit_id: visitId,
        deleted_at: null,
        notes: { contains: VISIT_TASK_OUTCOME_PREFIX },
        visit: {
          organization_id: organizationId,
          deleted_at: null,
        },
      },
    });
  }

  async countCareLogsForVisit(
    visitId: string,
    organizationId: string,
  ): Promise<number> {
    return this.prisma.careLog.count({
      where: this.prisma.whereNotDeleted({
        visit_id: visitId,
        organization_id: organizationId,
      }),
    });
  }

  async countMedicationOutcomesForVisit(
    visitId: string,
    organizationId: string,
  ): Promise<number> {
    return this.prisma.medicationAdministration.count({
      where: {
        visit_id: visitId,
        deleted_at: null,
        status: { not: MedicationStatus.SCHEDULED },
        visit: {
          organization_id: organizationId,
          deleted_at: null,
        },
      },
    });
  }

  async findCarerInOrganization(
    carerId: string,
    organizationId: string,
  ): Promise<boolean> {
    const carer = await (this.prisma as any).carer.findFirst({
      where: this.prisma.whereNotDeleted({
        id: carerId,
        organization_id: organizationId,
        is_active: true,
        organization_memberships: {
          some: {
            organization_id: organizationId,
            identity_provider: this.identityProvider(),
            auth_subject: { not: "" },
            role: { in: ["carer", "staff"] },
            status: "ACTIVE",
            revoked_at: null,
          },
        },
      }),
      select: { id: true },
    });
    return !!carer;
  }

  private identityProvider(): string {
    return String(process.env.AUTH_IDENTITY_PROVIDER || "cognito")
      .trim()
      .toLowerCase();
  }

  private assignmentLockKey(organizationId: string, carerId: string): string {
    return `carer-assignment:${organizationId}:${carerId}`;
  }

  private carerIdentityLockKey(organizationId: string, carerId: string): string {
    return `carer-identity:${organizationId}:${carerId}`;
  }

  async findClientInOrganization(
    clientId: string,
    organizationId: string,
  ): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: this.prisma.whereNotDeleted({
        id: clientId,
        organization_id: organizationId,
      }),
      select: { id: true },
    });
    return !!client;
  }
}
