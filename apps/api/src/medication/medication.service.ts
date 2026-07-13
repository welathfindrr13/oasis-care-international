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
import {
  type CanonicalCapabilityActor,
  hasCanonicalActorCapability,
} from '../auth/access-capability';
import {
  addCalendarDays,
  organizationCalendarDateToUtcStoredDate,
  parseOrganizationDateKey,
  resolveOrganizationWallClock,
  utcStoredDateToCalendarDate,
  type OrganizationCalendarDate,
} from '@oasis/time';
import { normalizeMedicationWallTime } from './medication-wall-time';

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

    const startCalendarDate = this.parsePrescriptionDateKey(data.startDate, 'start');
    const endCalendarDate = data.endDate
      ? this.parsePrescriptionDateKey(data.endDate, 'end')
      : null;
    if (
      endCalendarDate &&
      this.compareCalendarDates(startCalendarDate, endCalendarDate) > 0
    ) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Prescription start date must not be after its end date',
        HttpStatus.BAD_REQUEST,
      );
    }
    const startDate = organizationCalendarDateToUtcStoredDate(startCalendarDate);
    const endDate = endCalendarDate
      ? organizationCalendarDateToUtcStoredDate(endCalendarDate)
      : null;
    this.validateAdministrationTimes(data.administrationTimes);

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

    // Resolve every local schedule time before writing the prescription so a
    // DST ambiguity cannot leave a partially materialised care record.
    this.buildSchedulePlan(
      startDate,
      endDate,
      data.administrationTimes,
      orgId,
    );

    const prescription = await this.medicationRepository.createPrescription({
      client: { connect: { id: data.clientId } },
      medication: { connect: { id: data.medicationId } },
      start_date: startDate,
      end_date: endDate,
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
    actorAuthSubject?: string,
    accessContext?: CanonicalCapabilityActor,
  ): Promise<MedicationAdministration> {
    if (
      !organizationId ||
      !hasCanonicalActorCapability(accessContext, 'FRONTLINE_VISIT_EXECUTE', {
        organizationId,
        userId,
        userRole,
      })
    ) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Only the assigned Carer can record medication support',
        HttpStatus.FORBIDDEN,
      );
    }
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
      actorId: actorAuthSubject || userId,
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
    dateKey: string,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<MedicationAdministration[]> {
    try {
      parseOrganizationDateKey(dateKey);
    } catch {
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
    this.logger.log(`Fetching today's medications for organization date ${dateKey}`, { requestId });

    const administrations = await this.medicationRepository.findTodaysMedicationsByClient(
      dateKey,
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

  private validateAdministrationTimes(
    administrationTimes: unknown,
  ): Array<{ hours: number; minutes: number }> {
    if (!Array.isArray(administrationTimes) || administrationTimes.length === 0) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Prescription administration times must contain at least one valid wall time',
        HttpStatus.BAD_REQUEST,
      );
    }

    const parsedTimes: Array<{ hours: number; minutes: number }> = [];
    const uniqueTimes = new Set<string>();
    for (const time of administrationTimes) {
      const normalized = normalizeMedicationWallTime(time);
      if (!normalized) {
        throw new BaseHttpException(
          ErrorCode.VALIDATION_FAILED,
          'Prescription administration times must use a valid HH:mm wall time',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (uniqueTimes.has(normalized.canonical)) {
        throw new BaseHttpException(
          ErrorCode.VALIDATION_FAILED,
          'Prescription administration times must be unique',
          HttpStatus.BAD_REQUEST,
        );
      }
      uniqueTimes.add(normalized.canonical);
      parsedTimes.push({ hours: normalized.hours, minutes: normalized.minutes });
    }

    return parsedTimes;
  }

  private parsePrescriptionDateKey(
    value: string,
    field: 'start' | 'end',
  ): OrganizationCalendarDate {
    try {
      return parseOrganizationDateKey(value);
    } catch {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        `Prescription ${field} date must use YYYY-MM-DD`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private compareCalendarDates(
    left: OrganizationCalendarDate,
    right: OrganizationCalendarDate,
  ): number {
    return Date.UTC(left.year, left.month - 1, left.day)
      - Date.UTC(right.year, right.month - 1, right.day);
  }

  private buildSchedulePlan(
    startDate: Date,
    endDate: Date | null | undefined,
    administrationTimes: string[],
    organizationId: string,
  ): { candidates: Date[]; windowStart: Date; windowEndExclusive: Date } {
    const parsedTimes = this.validateAdministrationTimes(administrationTimes);

    const startCalendarDate = utcStoredDateToCalendarDate(startDate);
    const endCalendarDate = endDate
      ? utcStoredDateToCalendarDate(endDate)
      : addCalendarDays(startCalendarDate, 30);
    const candidates: Date[] = [];
    let cursor = startCalendarDate;

    while (this.compareCalendarDates(cursor, endCalendarDate) <= 0) {
      for (const t of parsedTimes) {
        const resolution = resolveOrganizationWallClock(
          { ...cursor, hour: t.hours, minute: t.minutes },
          organizationId,
        );
        if (resolution.kind !== 'unique') {
          throw new BaseHttpException(
            ErrorCode.MEDICATION_SCHEDULE_TIME_UNRESOLVED,
            'Medication schedule includes a local time affected by daylight saving. Clinical scheduling approval is required before materialisation.',
            HttpStatus.CONFLICT,
          );
        }
        candidates.push(resolution.instant);
      }
      cursor = addCalendarDays(cursor, 1);
    }

    const windowStartResolution = resolveOrganizationWallClock(
      { ...startCalendarDate, hour: 0, minute: 0 },
      organizationId,
    );
    const dayAfterEnd = addCalendarDays(endCalendarDate, 1);
    const windowEndResolution = resolveOrganizationWallClock(
      { ...dayAfterEnd, hour: 0, minute: 0 },
      organizationId,
    );
    if (windowStartResolution.kind !== 'unique' || windowEndResolution.kind !== 'unique') {
      throw new BaseHttpException(
        ErrorCode.MEDICATION_SCHEDULE_TIME_UNRESOLVED,
        'Medication schedule calendar boundary could not be resolved safely.',
        HttpStatus.CONFLICT,
      );
    }

    return {
      candidates,
      windowStart: windowStartResolution.instant,
      windowEndExclusive: windowEndResolution.instant,
    };
  }

  private async materializePrescriptionAdministrations(
    prescription: Prescription,
    organizationId: string,
  ): Promise<number> {
    const startDate = new Date(prescription.start_date);
    const plan = this.buildSchedulePlan(
      startDate,
      prescription.end_date,
      Array.isArray(prescription.administration_times) ? prescription.administration_times : [],
      organizationId,
    );

    if (!plan.candidates.length) {
      return 0;
    }

    const existing = await this.medicationRepository.findMedicationAdministrationTimesForPrescriptionWindow(
      prescription.id,
      plan.windowStart,
      new Date(plan.windowEndExclusive.getTime() - 1),
      organizationId,
    );
    const existingSet = new Set(existing.map((d) => d.toISOString()));

    const createPayload = plan.candidates
      .filter((scheduled) => !existingSet.has(scheduled.toISOString()))
      .map((scheduled) => ({
        prescription_id: prescription.id,
        scheduled_time: scheduled,
        status: MedicationStatus.SCHEDULED,
      }));

    return this.medicationRepository.createMedicationAdministrationsBulk(createPayload);
  }
}
