import { Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { 
  Medication, 
  Prescription, 
  MedicationAdministration, 
  MedicationStatus,
  MedicationAuditAction,
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
        administrations: true
      }
    });
  }

  async findPrescriptionById(id: string): Promise<Prescription | null> {
    return this.prisma.prescription.findUnique({
      where: { id, deleted_at: null },
      include: {
        client: true,
        medication: true,
        administrations: {
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
        administrations: true
      }
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

  async findTodaysMedicationsByClient(date: Date): Promise<MedicationAdministration[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.medicationAdministration.findMany({
      where: {
        scheduled_time: {
          gte: startOfDay,
          lte: endOfDay
        },
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
      orderBy: [
        { prescription: { client: { full_name: 'asc' } } },
        { scheduled_time: 'asc' }
      ]
    });
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
}
