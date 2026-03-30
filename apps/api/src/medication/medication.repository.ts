import { Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { 
  Medication, 
  Prescription, 
  MedicationAdministration, 
  MedicationStatus,
  MedicationAuditAction,
  Visit,
  VisitStatus,
  Prisma 
} from '@oasis/db';

@Injectable()
export class MedicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Medication CRUD
  async createMedication(data: Prisma.MedicationCreateInput): Promise<Medication> {
    return this.prisma.medication.create({ data });
  }

  async findMedicationById(id: string): Promise<Medication | null> {
    return this.prisma.medication.findUnique({
      where: { id, deleted_at: null },
      include: { prescriptions: true }
    });
  }

  async findMedications(params: {
    where?: Prisma.MedicationWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.MedicationOrderByWithRelationInput;
  }): Promise<{ items: Medication[]; total: number }> {
    const { where = {}, skip, take, orderBy } = params;
    const finalWhere = { ...where, deleted_at: null };

    const [items, total] = await Promise.all([
      this.prisma.medication.findMany({
        where: finalWhere,
        skip,
        take,
        orderBy,
        include: { prescriptions: true }
      }),
      this.prisma.medication.count({ where: finalWhere })
    ]);

    return { items, total };
  }

  // Prescription CRUD
  async createPrescription(data: Prisma.PrescriptionCreateInput): Promise<Prescription> {
    return this.prisma.prescription.create({
      data,
      include: {
        client: true,
        medication: true,
        administrations: {
          where: { deleted_at: null },
        }
      }
    });
  }

  async createPrescriptionWithSchedule(args: {
    prescription: Prisma.PrescriptionCreateInput;
    administrations: Array<{
      scheduledTime: Date;
      visitId?: string | null;
      notes?: string | null;
      instructionSnapshot?: string | null;
    }>;
    actorId: string;
    actorRole: string;
    auditChanges: Record<string, any>;
  }): Promise<Prescription> {
    return this.prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.create({
        data: args.prescription,
      });

      let createdAdministrationCount = 0;

      for (const administration of args.administrations) {
        const createdAdministration = await this.createScheduledAdministrationWithAudit(tx, {
          prescriptionId: prescription.id,
          administration,
          actorId: args.actorId,
          actorRole: args.actorRole,
          reason: undefined,
        });

        if (createdAdministration) {
          createdAdministrationCount += 1;
        }
      }

      await tx.medicationAudit.create({
        data: {
          prescription_id: prescription.id,
          action: MedicationAuditAction.PRESCRIPTION_CREATED,
          actor_id: args.actorId,
          actor_role: args.actorRole,
          changes: JSON.stringify({
            ...args.auditChanges,
            generatedAdministrationCount: createdAdministrationCount,
          }),
        },
      });

      return tx.prescription.findUniqueOrThrow({
        where: { id: prescription.id },
        include: {
          client: true,
          medication: true,
          administrations: {
            where: { deleted_at: null },
            orderBy: { scheduled_time: 'asc' },
          },
        },
      });
    });
  }

  async findPrescriptionById(id: string): Promise<Prescription | null> {
    return this.prisma.prescription.findUnique({
      where: { id, deleted_at: null },
      include: {
        client: true,
        medication: true,
        administrations: {
          where: { deleted_at: null },
          orderBy: { scheduled_time: 'asc' }
        }
      }
    });
  }

  async findPrescriptions(params: {
    where?: Prisma.PrescriptionWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.PrescriptionOrderByWithRelationInput;
  }): Promise<{ items: Prescription[]; total: number }> {
    const { where = {}, skip, take, orderBy } = params;
    const finalWhere = { ...where, deleted_at: null };

    const [items, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where: finalWhere,
        skip,
        take,
        orderBy,
        include: {
          client: true,
          medication: true,
          administrations: {
            where: { deleted_at: null },
            orderBy: { scheduled_time: 'asc' }
          }
        }
      }),
      this.prisma.prescription.count({ where: finalWhere })
    ]);

    return { items, total };
  }

  async updatePrescription(id: string, data: Prisma.PrescriptionUpdateInput): Promise<Prescription> {
    return this.prisma.prescription.update({
      where: { id },
      data,
      include: {
        client: true,
        medication: true,
        administrations: {
          where: { deleted_at: null },
          orderBy: { scheduled_time: 'asc' },
        }
      }
    });
  }

  async updatePrescriptionWithScheduleReconciliation(args: {
    prescriptionId: string;
    prescriptionData: Prisma.PrescriptionUpdateInput;
    cancelScheduledFrom?: Date;
    refreshInstructionSnapshotFrom?: Date;
    instructionSnapshot?: string | null;
    administrations: Array<{
      scheduledTime: Date;
      visitId?: string | null;
      notes?: string | null;
      instructionSnapshot?: string | null;
    }>;
    reconciliationReason: string;
    actorId: string;
    actorRole: string;
    auditChanges: Record<string, any>;
  }): Promise<Prescription> {
    return this.prisma.$transaction(async (tx) => {
      const updatedPrescription = await tx.prescription.update({
        where: { id: args.prescriptionId },
        data: args.prescriptionData,
      });

      let archivedAdministrationCount = 0;
      let refreshedInstructionSnapshotCount = 0;
      let createdAdministrationCount = 0;

      if (args.cancelScheduledFrom) {
        const administrationsToArchive = await tx.medicationAdministration.findMany({
          where: {
            prescription_id: args.prescriptionId,
            status: MedicationStatus.SCHEDULED,
            deleted_at: null,
            scheduled_time: {
              gte: args.cancelScheduledFrom,
            },
          },
          orderBy: { scheduled_time: 'asc' },
        });

        const archivedAt = new Date();

        for (const administration of administrationsToArchive) {
          await tx.medicationAdministration.update({
            where: { id: administration.id },
            data: {
              status: MedicationStatus.CANCELLED,
              deleted_at: archivedAt,
            },
          });

          await tx.medicationAudit.create({
            data: {
              prescription_id: args.prescriptionId,
              medication_administration_id: administration.id,
              action: MedicationAuditAction.MEDICATION_CANCELLED,
              actor_id: args.actorId,
              actor_role: args.actorRole,
              changes: JSON.stringify({
                scheduledTime: administration.scheduled_time.toISOString(),
                reason: args.reconciliationReason,
                archivedAt: archivedAt.toISOString(),
              }),
            },
          });
        }

        archivedAdministrationCount = administrationsToArchive.length;
      }

      if (args.refreshInstructionSnapshotFrom) {
        const updateResult = await tx.medicationAdministration.updateMany({
          where: {
            prescription_id: args.prescriptionId,
            status: MedicationStatus.SCHEDULED,
            deleted_at: null,
            scheduled_time: {
              gte: args.refreshInstructionSnapshotFrom,
            },
          },
          data: {
            instruction_snapshot: args.instructionSnapshot ?? null,
          },
        });

        refreshedInstructionSnapshotCount = updateResult.count;
      }

      for (const administration of args.administrations) {
        const createdAdministration = await this.createScheduledAdministrationWithAudit(tx, {
          prescriptionId: args.prescriptionId,
          administration,
          actorId: args.actorId,
          actorRole: args.actorRole,
          reason: args.reconciliationReason,
        });

        if (createdAdministration) {
          createdAdministrationCount += 1;
        }
      }

      await tx.medicationAudit.create({
        data: {
          prescription_id: args.prescriptionId,
          action: MedicationAuditAction.PRESCRIPTION_UPDATED,
          actor_id: args.actorId,
          actor_role: args.actorRole,
          changes: JSON.stringify({
            ...args.auditChanges,
            archivedAdministrationCount,
            refreshedInstructionSnapshotCount,
            generatedAdministrationCount: createdAdministrationCount,
          }),
        },
      });

      return tx.prescription.findUniqueOrThrow({
        where: { id: updatedPrescription.id },
        include: {
          client: true,
          medication: true,
          administrations: {
            where: { deleted_at: null },
            orderBy: { scheduled_time: 'asc' },
          },
        },
      });
    });
  }

  async findActivePrescriptionsOverlappingWindow(
    start: Date,
    end: Date,
    options: { clientId?: string } = {}
  ): Promise<Array<Prescription & { medication: Medication }>> {
    return this.prisma.prescription.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        client_id: options.clientId,
        start_date: {
          lte: end,
        },
        OR: [
          { end_date: null },
          {
            end_date: {
              gte: start,
            },
          },
        ],
      },
      include: {
        medication: true,
      },
      orderBy: { start_date: 'asc' },
    });
  }

  async ensureScheduledAdministrationsForPrescription(args: {
    prescriptionId: string;
    administrations: Array<{
      scheduledTime: Date;
      visitId?: string | null;
      notes?: string | null;
      instructionSnapshot?: string | null;
    }>;
    actorId: string;
    actorRole: string;
    reason: string;
  }): Promise<number> {
    if (!args.administrations.length) {
      return 0;
    }

    return this.prisma.$transaction(async (tx) => {
      const existingAdministrations = await tx.medicationAdministration.findMany({
        where: {
          prescription_id: args.prescriptionId,
          deleted_at: null,
          scheduled_time: {
            in: args.administrations.map((administration) => administration.scheduledTime),
          },
        },
        select: {
          scheduled_time: true,
        },
      });

      const existingKeys = new Set(
        existingAdministrations.map((administration) =>
          administration.scheduled_time.toISOString()
        )
      );

      let createdCount = 0;

      for (const administration of args.administrations) {
        const scheduledTimeKey = administration.scheduledTime.toISOString();
        if (existingKeys.has(scheduledTimeKey)) {
          continue;
        }

        const createdAdministration = await this.createScheduledAdministrationWithAudit(tx, {
          prescriptionId: args.prescriptionId,
          administration,
          actorId: args.actorId,
          actorRole: args.actorRole,
          reason: args.reason,
        });

        existingKeys.add(scheduledTimeKey);
        if (createdAdministration) {
          createdCount += 1;
        }
      }

      return createdCount;
    });
  }

  // Medication Administration CRUD
  async createMedicationAdministration(data: Prisma.MedicationAdministrationCreateInput): Promise<MedicationAdministration> {
    return this.prisma.medicationAdministration.create({
      data,
      include: {
        prescription: {
          include: {
            client: true,
            medication: true
          }
        },
        visit: true
      }
    });
  }

  async findMedicationAdministrationById(id: string): Promise<MedicationAdministration | null> {
    return this.prisma.medicationAdministration.findUnique({
      where: { id, deleted_at: null },
      include: {
        prescription: {
          include: {
            client: true,
            medication: true
          }
        },
        visit: true
      }
    });
  }

  async findMedicationAdministrations(params: {
    where?: Prisma.MedicationAdministrationWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.MedicationAdministrationOrderByWithRelationInput;
  }): Promise<{ items: MedicationAdministration[]; total: number }> {
    const { where = {}, skip, take, orderBy } = params;
    const finalWhere = { ...where, deleted_at: null };

    const [items, total] = await Promise.all([
      this.prisma.medicationAdministration.findMany({
        where: finalWhere,
        skip,
        take,
        orderBy,
        include: {
          prescription: {
            include: {
              client: true,
              medication: true
            }
          },
          visit: true
        }
      }),
      this.prisma.medicationAdministration.count({ where: finalWhere })
    ]);

    return { items, total };
  }

  async updateMedicationAdministration(id: string, data: Prisma.MedicationAdministrationUpdateInput): Promise<MedicationAdministration> {
    return this.prisma.medicationAdministration.update({
      where: { id },
      data,
      include: {
        prescription: {
          include: {
            client: true,
            medication: true
          }
        },
        visit: true
      }
    });
  }

  async findVisitsForClientInRange(
    clientId: string,
    start: Date,
    end: Date
  ): Promise<Visit[]> {
    return this.prisma.visit.findMany({
      where: {
        client_id: clientId,
        deleted_at: null,
        status: { not: VisitStatus.CANCELLED },
        scheduled_start: { lte: end },
        scheduled_end: { gte: start },
      },
      orderBy: { scheduled_start: 'asc' },
    });
  }

  async findVisitById(id: string): Promise<Visit | null> {
    return this.prisma.visit.findUnique({
      where: { id, deleted_at: null },
    });
  }

  async findScheduledMedicationAdministrationsForClientInRange(
    clientId: string,
    start: Date,
    end: Date
  ): Promise<MedicationAdministration[]> {
    return this.prisma.medicationAdministration.findMany({
      where: {
        deleted_at: null,
        status: MedicationStatus.SCHEDULED,
        scheduled_time: {
          gte: start,
          lte: end,
        },
        prescription: {
          client_id: clientId,
          deleted_at: null,
          is_active: true,
        },
      },
      include: {
        prescription: {
          include: {
            client: true,
            medication: true,
          },
        },
        visit: true,
      },
      orderBy: { scheduled_time: 'asc' },
    });
  }

  // Specialized queries for eMAR
  async findDueMedicationsForVisit(visitId: string): Promise<any[]> {
    return this.prisma.medicationAdministration.findMany({
      where: {
        visit_id: visitId,
        status: MedicationStatus.SCHEDULED,
        deleted_at: null
      },
      include: {
        prescription: {
          include: {
            client: true,
            medication: true
          }
        },
        visit: true
      },
      orderBy: { scheduled_time: 'asc' }
    });
  }

  async findVisitMedications(visitId: string): Promise<any[]> {
    return this.prisma.medicationAdministration.findMany({
      where: {
        visit_id: visitId,
        deleted_at: null,
      },
      include: {
        prescription: {
          include: {
            client: true,
            medication: true
          }
        },
        visit: true
      },
      orderBy: { scheduled_time: 'asc' }
    });
  }

  async findTodaysMedicationsByClient(
    startOfDay: Date,
    endOfDay: Date,
    options: { carerId?: string } = {}
  ): Promise<MedicationAdministration[]> {
    const carerClause = options.carerId
      ? Prisma.sql`AND v.carer_id = ${options.carerId}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        ma.id,
        ma.prescription_id,
        ma.visit_id,
        ma.scheduled_time,
        ma.administered_time,
        ma.administered_by,
        ma.status,
        ma.notes,
        ma.instruction_snapshot,
        ma.created_at,
        ma.updated_at,
        p.id AS prescription_row_id,
        p.client_id AS prescription_client_id,
        p.medication_id AS prescription_medication_id,
        p.start_date AS prescription_start_date,
        p.end_date AS prescription_end_date,
        p.frequency_per_day AS prescription_frequency_per_day,
        p.frequency_interval_hours AS prescription_frequency_interval_hours,
        p.administration_times AS prescription_administration_times,
        p.special_instructions AS prescription_special_instructions,
        p.is_active AS prescription_is_active,
        p.created_at AS prescription_created_at,
        p.updated_at AS prescription_updated_at,
        c.id AS client_row_id,
        c.full_name AS client_full_name,
        c.address_line1 AS client_address_line1,
        c.address_line2 AS client_address_line2,
        c.city AS client_city,
        c.postcode AS client_postcode,
        m.id AS medication_row_id,
        m.name AS medication_name,
        m.dosage AS medication_dosage,
        m.unit AS medication_unit,
        m.instructions AS medication_instructions,
        m.created_at AS medication_created_at,
        m.updated_at AS medication_updated_at,
        v.id AS visit_row_id,
        v.carer_id AS visit_carer_id,
        v.client_id AS visit_client_id,
        v.scheduled_start AS visit_scheduled_start,
        v.scheduled_end AS visit_scheduled_end
      FROM medication_administration ma
      INNER JOIN prescription p
        ON p.id = ma.prescription_id
       AND p.deleted_at IS NULL
      INNER JOIN client c
        ON c.id = p.client_id
       AND c.deleted_at IS NULL
      INNER JOIN medication m
        ON m.id = p.medication_id
       AND m.deleted_at IS NULL
      LEFT JOIN visit v
        ON v.id = ma.visit_id
       AND v.deleted_at IS NULL
      WHERE ma.deleted_at IS NULL
        AND ma.scheduled_time >= ${startOfDay}
        AND ma.scheduled_time <= ${endOfDay}
        ${carerClause}
      ORDER BY c.full_name ASC, ma.scheduled_time ASC
    `);

    return rows.map((row) => ({
      id: row.id,
      prescription_id: row.prescription_id,
      visit_id: row.visit_id,
      scheduled_time: row.scheduled_time,
      administered_time: row.administered_time,
      administered_by: row.administered_by,
      status: row.status,
      notes: row.notes,
      instruction_snapshot: row.instruction_snapshot,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: null,
      prescription: {
        id: row.prescription_row_id,
        client_id: row.prescription_client_id,
        medication_id: row.prescription_medication_id,
        start_date: row.prescription_start_date,
        end_date: row.prescription_end_date,
        frequency_per_day: row.prescription_frequency_per_day,
        frequency_interval_hours: row.prescription_frequency_interval_hours,
        administration_times: row.prescription_administration_times,
        special_instructions: row.prescription_special_instructions,
        is_active: row.prescription_is_active,
        created_at: row.prescription_created_at,
        updated_at: row.prescription_updated_at,
        deleted_at: null,
        client: {
          id: row.client_row_id,
          full_name: row.client_full_name,
          address_line1: row.client_address_line1,
          address_line2: row.client_address_line2,
          city: row.client_city,
          postcode: row.client_postcode,
          deleted_at: null,
        },
        medication: {
          id: row.medication_row_id,
          name: row.medication_name,
          dosage: row.medication_dosage,
          unit: row.medication_unit,
          instructions: row.medication_instructions,
          created_at: row.medication_created_at,
          updated_at: row.medication_updated_at,
          deleted_at: null,
        },
      },
      visit: row.visit_row_id
        ? {
            id: row.visit_row_id,
            carer_id: row.visit_carer_id,
            client_id: row.visit_client_id,
            scheduled_start: row.visit_scheduled_start,
            scheduled_end: row.visit_scheduled_end,
            actual_start: null,
            actual_end: null,
            status: 'SCHEDULED',
            notes: null,
            created_at: row.visit_scheduled_start,
            updated_at: row.visit_scheduled_end,
            deleted_at: null,
          }
        : null,
    })) as unknown as MedicationAdministration[];
  }

  async findOverlappingMedicationTimes(
    prescriptionId: string,
    scheduledTime: Date,
    windowMinutes: number = 30
  ): Promise<MedicationAdministration[]> {
    const startTime = new Date(scheduledTime.getTime() - windowMinutes * 60000);
    const endTime = new Date(scheduledTime.getTime() + windowMinutes * 60000);

    return this.prisma.medicationAdministration.findMany({
      where: {
        prescription_id: prescriptionId,
        scheduled_time: {
          gte: startTime,
          lte: endTime
        },
        status: {
          in: [MedicationStatus.SCHEDULED, MedicationStatus.ADMINISTERED]
        },
        deleted_at: null
      }
    });
  }

  // Audit logging
  async createMedicationAudit(data: {
    prescriptionId?: string;
    medicationAdministrationId?: string;
    action: MedicationAuditAction;
    actorId: string;
    actorRole: string;
    changes: Record<string, any>;
  }) {
    return this.prisma.medicationAudit.create({
      data: {
        prescription_id: data.prescriptionId,
        medication_administration_id: data.medicationAdministrationId,
        action: data.action,
        actor_id: data.actorId,
        actor_role: data.actorRole,
        changes: JSON.stringify(data.changes)
      }
    });
  }

  private async createScheduledAdministrationWithAudit(
    tx: Prisma.TransactionClient,
    args: {
      prescriptionId: string;
      administration: {
        scheduledTime: Date;
        visitId?: string | null;
        notes?: string | null;
        instructionSnapshot?: string | null;
      };
      actorId: string;
      actorRole: string;
      reason?: string;
    }
  ) {
    try {
      const createdAdministration = await tx.medicationAdministration.create({
        data: {
          prescription: { connect: { id: args.prescriptionId } },
          visit: args.administration.visitId
            ? { connect: { id: args.administration.visitId } }
            : undefined,
          scheduled_time: args.administration.scheduledTime,
          status: MedicationStatus.SCHEDULED,
          notes: args.administration.notes ?? undefined,
          instruction_snapshot: args.administration.instructionSnapshot ?? undefined,
        },
      });

      await tx.medicationAudit.create({
        data: {
          prescription_id: args.prescriptionId,
          medication_administration_id: createdAdministration.id,
          action: MedicationAuditAction.MEDICATION_SCHEDULED,
          actor_id: args.actorId,
          actor_role: args.actorRole,
          changes: JSON.stringify({
            scheduledTime: args.administration.scheduledTime.toISOString(),
            visitId: args.administration.visitId ?? null,
            reason: args.reason,
          }),
        },
      });

      return createdAdministration;
    } catch (error) {
      if (this.isUniqueScheduledAdministrationConflict(error)) {
        return null;
      }

      throw error;
    }
  }

  private isUniqueScheduledAdministrationConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
