import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { MedicationRepository } from './medication.repository';
import { CreateMedicationInput } from './dto/create-medication.input';
import { 
  Medication, 
  Prescription, 
  MedicationAdministration, 
  MedicationStatus,
  MedicationAuditAction
} from '@oasis/db';
import { ClsService } from 'nestjs-cls';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { Inject } from '@nestjs/common';
import { Counter } from 'prom-client';

// Inline types for now
interface CreatePrescriptionInput {
  clientId: string;
  medicationId: string;
  startDate: string;
  endDate?: string;
  frequencyPerDay: number;
  frequencyIntervalHours?: number;
  administrationTimes: string[];
  specialInstructions?: string;
  isActive?: boolean;
}

interface RecordAdministrationInput {
  administrationId: string;
  status: MedicationStatus;
  notes?: string;
}

interface MedicationFilterArgs {
  name?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class MedicationService {
  private readonly logger = new Logger(MedicationService.name);

  constructor(
    private readonly medicationRepository: MedicationRepository,
    private readonly cls: ClsService,
    @Inject('medication_administrations_total') private readonly adminCounter: Counter,
    @Inject('medication_overlaps_total') private readonly overlapCounter: Counter,
  ) {}

  async createMedication(
    data: CreateMedicationInput,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<Medication> {
    await this.requireOrganizationId(organizationId);
    const normalizedRole = this.normalizeRole(userRole);
    this.checkAdminAccess(normalizedRole);
    
    const requestId = this.cls.get('requestId');
    this.logger.log(`Creating medication ${data.name}`, { requestId });

    const medication = await this.medicationRepository.createMedication({
      name: data.name,
      dosage: data.dosage,
      unit: data.unit,
      instructions: data.instructions,
    });

    await this.medicationRepository.createMedicationAudit({
      organizationId: organizationId!,
      action: MedicationAuditAction.PRESCRIPTION_CREATED,
      actorId: userId,
      actorRole: userRole,
      changes: { medicationId: medication.id, ...data }
    });

    return medication;
  }

  async createPrescription(
    data: CreatePrescriptionInput,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<Prescription> {
    const orgId = await this.requireOrganizationId(organizationId);
    const normalizedRole = this.normalizeRole(userRole);
    this.checkAdminAccess(normalizedRole);
    
    const requestId = this.cls.get('requestId');
    this.logger.log(`Creating prescription for client ${data.clientId}`, { requestId });

    // Validate medication exists
    const medication = await this.medicationRepository.findMedicationById(data.medicationId);
    if (!medication) {
      throw new BaseHttpException(
        ErrorCode.MEDICATION_NOT_FOUND,
        'Medication not found',
        HttpStatus.NOT_FOUND
      );
    }

    const clientExists = await this.medicationRepository.findClientInOrganization(data.clientId, orgId);
    if (!clientExists) {
      throw new BaseHttpException(
        ErrorCode.CLIENT_NOT_FOUND,
        'Client not found in organization',
        HttpStatus.NOT_FOUND,
      );
    }

    const prescription = await this.medicationRepository.createPrescription({
      client: { connect: { id: data.clientId } },
      medication: { connect: { id: data.medicationId } },
      start_date: new Date(data.startDate),
      end_date: data.endDate ? new Date(data.endDate) : null,
      frequency_per_day: data.frequencyPerDay,
      frequency_interval_hours: data.frequencyIntervalHours,
      administration_times: data.administrationTimes,
      special_instructions: data.specialInstructions,
      is_active: data.isActive ?? true,
    });

    const administrationsCreated = await this.materializePrescriptionAdministrations(
      prescription,
      orgId,
    );

    await this.medicationRepository.createMedicationAudit({
      organizationId: orgId,
      prescriptionId: prescription.id,
      action: MedicationAuditAction.PRESCRIPTION_CREATED,
      actorId: userId,
      actorRole: userRole,
      changes: { ...data, administrationsCreated }
    });

    return prescription;
  }

  async listDueMeds(
    visitId: string,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<any[]> {
    const orgId = await this.requireOrganizationId(organizationId);
    const normalizedRole = this.normalizeRole(userRole);
    this.checkMedicationReadAccess(normalizedRole);
    const requestId = this.cls.get('requestId');
    this.logger.log(`Fetching due medications for visit ${visitId}`, { requestId });

    // Check if user has access to this visit (implement similar to visit service)
    const dueMeds = await this.medicationRepository.findDueMedicationsForVisit(visitId, orgId);
    
    // Role-based filtering if needed
    if (normalizedRole === 'carer') {
      // Ensure carer is assigned to this visit
      const visitMeds = dueMeds.filter(med => 
        med.visit && med.visit.carer_id === userId
      );
      return visitMeds;
    }

    return dueMeds;
  }

  async recordAdministration(
    data: RecordAdministrationInput,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<MedicationAdministration> {
    const orgId = await this.requireOrganizationId(organizationId);
    const normalizedRole = this.normalizeRole(userRole);
    this.checkMedicationReadAccess(normalizedRole);
    const requestId = this.cls.get('requestId');
    this.logger.log(`Recording medication administration ${data.administrationId}`, { requestId });

    const administration = await this.medicationRepository.findMedicationAdministrationById(
      data.administrationId,
      orgId,
    );
    if (!administration) {
      throw new BaseHttpException(
        ErrorCode.MEDICATION_ADMINISTRATION_NOT_FOUND,
        'Medication administration record not found',
        HttpStatus.NOT_FOUND
      );
    }

    // Check permissions - carer must be assigned to the visit
    if (normalizedRole === 'carer' && (administration as any).visit?.carer_id !== userId) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'You can only record medications for your own visits',
        HttpStatus.FORBIDDEN
      );
    }

    // Check for timing overlaps (prevent double-dosing)
    if (data.status === MedicationStatus.ADMINISTERED) {
      const overlaps = await this.medicationRepository.findOverlappingMedicationTimes(
        administration.prescription_id,
        administration.scheduled_time,
        30,
        orgId,
      );

      const alreadyAdministered = overlaps.filter(med => 
        med.id !== administration.id && 
        med.status === MedicationStatus.ADMINISTERED
      );

      if (alreadyAdministered.length > 0) {
        this.overlapCounter.inc();
        this.logger.warn(
          `Potential medication overlap for prescription ${administration.prescription_id}`,
          { requestId, overlaps: alreadyAdministered.map(m => m.id) }
        );
        throw new BaseHttpException(
          ErrorCode.MEDICATION_OVERLAP,
          'This medication was already administered within the time window',
          HttpStatus.CONFLICT
        );
      }
    }

    const updatedAdministration = await this.medicationRepository.updateMedicationAdministration(
      administration.id,
      orgId,
      {
        status: data.status,
        administered_time: data.status === MedicationStatus.ADMINISTERED ? new Date() : null,
        administered_by: data.status === MedicationStatus.ADMINISTERED ? userId : null,
        notes: data.notes || administration.notes,
      }
    );

    await this.medicationRepository.createMedicationAudit({
      organizationId: orgId,
      medicationAdministrationId: updatedAdministration.id,
      action: this.getAuditActionForStatus(data.status),
      actorId: userId,
      actorRole: userRole,
      changes: {
        status: data.status,
        notes: data.notes,
        administeredTime: updatedAdministration.administered_time
      }
    });

    this.adminCounter.inc();
    this.logger.log(`Medication administration ${updatedAdministration.id} updated`, { requestId });
    
    return updatedAdministration;
  }

  async getTodaysMedicationsByClient(
    date: Date,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<MedicationAdministration[]> {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'A valid medication date is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const orgId = await this.requireOrganizationId(organizationId);
    const normalizedRole = this.normalizeRole(userRole);
    this.checkClinicalAccess(normalizedRole);
    
    const requestId = this.cls.get('requestId');
    this.logger.log(`Fetching today's medications for date ${date.toISOString()}`, { requestId });

    const administrations = await this.medicationRepository.findTodaysMedicationsByClient(
      date,
      orgId,
      normalizedRole === 'carer' ? userId : undefined,
    );

    return administrations.filter((administration) => {
      const administrationWithRelations = administration as MedicationAdministration & {
        prescription?: { client?: unknown; medication?: unknown } | null;
      };
      const hasPrescription = Boolean(administrationWithRelations.prescription);
      const hasClient = Boolean(administrationWithRelations.prescription?.client);
      const hasMedication = Boolean(administrationWithRelations.prescription?.medication);

      if (hasPrescription && hasClient && hasMedication) {
        return true;
      }

      this.logger.warn(
        `Skipping incomplete medication administration ${administration.id} in organization ${orgId}`,
        { requestId, userId, normalizedRole },
      );
      return false;
    });
  }

  async findMedications(
    filter: MedicationFilterArgs,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<{ items: Medication[]; total: number }> {
    await this.requireOrganizationId(organizationId);
    const normalizedRole = this.normalizeRole(userRole);
    this.checkMedicationReadAccess(normalizedRole);
    const requestId = this.cls.get('requestId');
    const where: any = {};

    // Apply filters
    if (filter.name) {
      where.name = { contains: filter.name, mode: 'insensitive' };
    }

    this.logger.log(`Finding medications with filter`, { requestId, where });

    return this.medicationRepository.findMedications({
      where,
      skip: filter.skip,
      take: filter.take || 20,
      orderBy: { name: 'asc' },
    });
  }

  private checkAdminAccess(userRole: string): void {
    if (userRole !== 'admin') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ADMIN_ONLY,
        'Admin access required',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private checkClinicalAccess(userRole: string): void {
    if (!['admin', 'office', 'manager', 'care_manager', 'carer'].includes(userRole)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OFFICE_ACCESS,
        'Clinical staff access required',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private checkMedicationReadAccess(userRole: string): void {
    if (!['admin', 'carer'].includes(userRole)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Clinical staff access required',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private normalizeRole(userRole: string): string {
    return (userRole || '').toLowerCase();
  }

  private async requireOrganizationId(organizationId?: string): Promise<string> {
    const orgId = (organizationId || '').trim();
    if (orgId) {
      return orgId;
    }

    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
      'Organization context is required for this request',
      HttpStatus.FORBIDDEN,
    );
  }

  private getAuditActionForStatus(status: MedicationStatus): MedicationAuditAction {
    switch (status) {
      case MedicationStatus.ADMINISTERED:
        return MedicationAuditAction.MEDICATION_ADMINISTERED;
      case MedicationStatus.MISSED:
        return MedicationAuditAction.MEDICATION_MISSED;
      case MedicationStatus.REFUSED:
        return MedicationAuditAction.MEDICATION_REFUSED;
      case MedicationStatus.CANCELLED:
        return MedicationAuditAction.MEDICATION_CANCELLED;
      default:
        return MedicationAuditAction.MEDICATION_SCHEDULED;
    }
  }

  private materializationWindowEnd(startDate: Date, endDate?: Date | null): Date {
    if (endDate) {
      const bounded = new Date(endDate);
      bounded.setUTCHours(23, 59, 59, 999);
      return bounded;
    }
    const fallback = new Date(startDate);
    fallback.setUTCDate(fallback.getUTCDate() + 30);
    fallback.setUTCHours(23, 59, 59, 999);
    return fallback;
  }

  private parseTimeOfDay(time: string): { hours: number; minutes: number } | null {
    const normalized = String(time || '').trim();
    const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  }

  private buildScheduleCandidates(
    startDate: Date,
    endDate: Date,
    administrationTimes: string[],
  ): Date[] {
    const parsedTimes = administrationTimes
      .map((time) => this.parseTimeOfDay(time))
      .filter((value): value is { hours: number; minutes: number } => Boolean(value));

    const candidates: Date[] = [];
    const cursor = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ));

    while (cursor <= endDate) {
      for (const t of parsedTimes) {
        const scheduled = new Date(Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
          t.hours,
          t.minutes,
          0,
          0,
        ));
        if (scheduled >= startDate && scheduled <= endDate) {
          candidates.push(scheduled);
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return candidates;
  }

  private async materializePrescriptionAdministrations(
    prescription: Prescription,
    organizationId: string,
  ): Promise<number> {
    const startDate = new Date(prescription.start_date);
    const endDate = this.materializationWindowEnd(startDate, prescription.end_date);
    const candidates = this.buildScheduleCandidates(
      startDate,
      endDate,
      Array.isArray(prescription.administration_times) ? prescription.administration_times : [],
    );

    if (!candidates.length) {
      return 0;
    }

    const existing = await this.medicationRepository.findMedicationAdministrationTimesForPrescriptionWindow(
      prescription.id,
      startDate,
      endDate,
      organizationId,
    );
    const existingSet = new Set(existing.map((d) => d.toISOString()));

    const createPayload = candidates
      .filter((scheduled) => !existingSet.has(scheduled.toISOString()))
      .map((scheduled) => ({
        prescription_id: prescription.id,
        scheduled_time: scheduled,
        status: MedicationStatus.SCHEDULED,
      }));

    return this.medicationRepository.createMedicationAdministrationsBulk(createPayload);
  }
}
