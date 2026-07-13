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

export type CompleteVisitConflictReason =
  | "CANCELLED"
  | "COMPLETED_DETAILS"
  | "ACTUAL_END";

export type CompleteVisitAtomicResult =
  | { status: "COMPLETED" | "IDEMPOTENT"; visit: Visit }
  | { status: "NOT_FOUND" | "FORBIDDEN" | "EVIDENCE_REQUIRED" }
  | { status: "CONFLICT"; reason: CompleteVisitConflictReason };

export type CompleteVisitAtomicInput = {
  visitId: string;
  organizationId: string;
  expectedCarerId: string;
  completionNote: string | null;
  requestedActualEnd: Date | null;
  actualEndWasProvided: boolean;
  actor: {
    authSubject: string;
    membershipId: string | null;
    role: string;
  };
};

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

  async completeAtomically(
    input: CompleteVisitAtomicInput,
  ): Promise<CompleteVisitAtomicResult> {
    return (this.prisma as any).$transaction(
      async (tx: Prisma.TransactionClient) => {
        const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM visit
          WHERE id = ${input.visitId}
            AND organization_id = ${input.organizationId}
            AND deleted_at IS NULL
          FOR UPDATE
        `;
        if (lockedRows.length === 0) {
          return { status: "NOT_FOUND" } as const;
        }

        const visit = await tx.visit.findFirst({
          where: {
            id: input.visitId,
            organization_id: input.organizationId,
            deleted_at: null,
          },
          include: {
            carer: true,
            client: true,
            tasks: { where: { deleted_at: null } },
          },
        });
        if (!visit) {
          return { status: "NOT_FOUND" } as const;
        }
        if (visit.carer_id !== input.expectedCarerId) {
          return { status: "FORBIDDEN" } as const;
        }
        if (visit.status === VisitStatus.CANCELLED) {
          return { status: "CONFLICT", reason: "CANCELLED" } as const;
        }

        if (visit.status === VisitStatus.COMPLETED) {
          const completionAudit = await tx.auditLog.findFirst({
            where: {
              organization_id: input.organizationId,
              resource_type: "Visit",
              resource_id: visit.id,
              action: "VISIT_COMPLETED",
            },
            orderBy: { timestamp: "desc" },
          });
          const completionMetadata = this.completionMetadata(
            completionAudit?.new_values,
          );
          const actualEndMatches =
            completionMetadata?.actualEndWasProvided ===
              input.actualEndWasProvided &&
            (!input.actualEndWasProvided ||
              (visit.actual_end !== null &&
                input.requestedActualEnd !== null &&
                visit.actual_end.getTime() ===
                  input.requestedActualEnd.getTime()));
          const noteMatches = Boolean(
            completionMetadata &&
              completionMetadata.notesAppended ===
                Boolean(input.completionNote) &&
              (!completionMetadata.notesAppended ||
                this.completionNoteAlreadyPresent(
                  visit.notes,
                  input.completionNote,
                )),
          );
          if (!actualEndMatches || !noteMatches) {
            return {
              status: "CONFLICT",
              reason: "COMPLETED_DETAILS",
            } as const;
          }

          await this.createCompletionAudit(tx, {
            action: "VISIT_COMPLETION_IDEMPOTENT",
            input,
            previousStatus: visit.status,
            previousActualEnd: visit.actual_end,
            effectiveActualEnd: visit.actual_end,
            notesAppended: false,
          });
          return { status: "IDEMPOTENT", visit } as const;
        }

        if (
          visit.actual_end &&
          input.actualEndWasProvided &&
          input.requestedActualEnd &&
          visit.actual_end.getTime() !== input.requestedActualEnd.getTime()
        ) {
          return { status: "CONFLICT", reason: "ACTUAL_END" } as const;
        }

        const [taskOutcomeCount, careLogCount, medicationOutcomeCount] =
          await Promise.all([
            tx.visitTask.count({
              where: {
                visit_id: visit.id,
                deleted_at: null,
                notes: { contains: VISIT_TASK_OUTCOME_PREFIX },
              },
            }),
            tx.careLog.count({
              where: {
                visit_id: visit.id,
                organization_id: input.organizationId,
                deleted_at: null,
              },
            }),
            tx.medicationAdministration.count({
              where: {
                visit_id: visit.id,
                deleted_at: null,
                status: { not: MedicationStatus.SCHEDULED },
              },
            }),
          ]);
        const hasCompletionEvidence = Boolean(
          input.completionNote ||
            this.nonEmpty(visit.notes) ||
            taskOutcomeCount > 0 ||
            careLogCount > 0 ||
            medicationOutcomeCount > 0,
        );
        if (!hasCompletionEvidence) {
          return { status: "EVIDENCE_REQUIRED" } as const;
        }

        const recordedAt = new Date();
        const effectiveActualEnd =
          visit.actual_end || input.requestedActualEnd || recordedAt;
        const notes = input.completionNote
          ? this.appendCompletionNote(visit.notes, input.completionNote)
          : visit.notes;
        const updated = await tx.visit.update({
          where: { id: visit.id },
          data: {
            status: VisitStatus.COMPLETED,
            actual_end: effectiveActualEnd,
            ...(input.completionNote ? { notes } : {}),
          },
          include: {
            carer: true,
            client: true,
            tasks: { where: { deleted_at: null } },
          },
        });

        await this.createCompletionAudit(tx, {
          action: "VISIT_COMPLETED",
          input,
          previousStatus: visit.status,
          previousActualEnd: visit.actual_end,
          effectiveActualEnd,
          notesAppended: Boolean(input.completionNote),
          timestamp: recordedAt,
        });

        return { status: "COMPLETED", visit: updated } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
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

  private nonEmpty(value: string | null | undefined): string | null {
    const normalized = (value || "").trim();
    return normalized || null;
  }

  private appendCompletionNote(
    current: string | null,
    completionNote: string,
  ): string {
    return current ? `${current}\n${completionNote}` : completionNote;
  }

  private completionNoteAlreadyPresent(
    current: string | null,
    completionNote: string | null,
  ): boolean {
    if (!completionNote) return true;
    const normalized = this.nonEmpty(current);
    return Boolean(
      normalized === completionNote ||
        normalized?.endsWith(`\n${completionNote}`),
    );
  }

  private completionMetadata(value: Prisma.JsonValue | null | undefined): {
    actualEndWasProvided: boolean;
    notesAppended: boolean;
  } | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const metadata = value as Prisma.JsonObject;
    if (
      typeof metadata.actualEndWasProvided !== "boolean" ||
      typeof metadata.notesAppended !== "boolean"
    ) {
      return null;
    }
    return {
      actualEndWasProvided: metadata.actualEndWasProvided,
      notesAppended: metadata.notesAppended,
    };
  }

  private async createCompletionAudit(
    tx: Prisma.TransactionClient,
    options: {
      action: "VISIT_COMPLETED" | "VISIT_COMPLETION_IDEMPOTENT";
      input: CompleteVisitAtomicInput;
      previousStatus: VisitStatus;
      previousActualEnd: Date | null;
      effectiveActualEnd: Date | null;
      notesAppended: boolean;
      timestamp?: Date;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organization_id: options.input.organizationId,
        user_id: options.input.actor.authSubject,
        action: options.action,
        resource_type: "Visit",
        resource_id: options.input.visitId,
        old_values: {
          status: options.previousStatus,
          actualEnd: options.previousActualEnd?.toISOString() ?? null,
        },
        new_values: {
          status: VisitStatus.COMPLETED,
          actualEnd: options.effectiveActualEnd?.toISOString() ?? null,
          membershipId: options.input.actor.membershipId,
          actorRole: options.input.actor.role,
          notesAppended: options.notesAppended,
          actualEndWasProvided: options.input.actualEndWasProvided,
        },
        timestamp: options.timestamp || new Date(),
      },
    });
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
