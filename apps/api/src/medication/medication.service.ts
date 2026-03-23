import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { MedicationRepository } from './medication.repository';
import { CreateMedicationInput } from './dto/create-medication.input';
import { 
  Medication, 
  Prescription, 
  MedicationAdministration, 
  MedicationStatus,
  MedicationAuditAction,
  Visit,
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

interface UpdatePrescriptionInput {
  id: string;
  startDate: string;
  endDate?: string;
  frequencyPerDay: number;
  frequencyIntervalHours?: number;
  administrationTimes: string[];
  specialInstructions?: string;
  isActive: boolean;
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

interface ClientPrescriptionFilter {
  clientId: string;
  activeOnly?: boolean;
}

interface MedicationSchedulingWindow {
  start: Date;
  end: Date;
}

interface ScheduledAdministrationDraft {
  scheduledTime: Date;
  visitId: string | null;
}

interface PrescriptionScheduleSnapshot {
  startDate: string;
  endDate: string | null;
  frequencyPerDay: number;
  frequencyIntervalHours: number | null;
  administrationTimes: string[];
  isActive: boolean;
}

const PRESCRIPTION_SCHEDULING_HORIZON_DAYS = 30;
const VISIT_MATCH_MAX_DISTANCE_MS = 2 * 60 * 60 * 1000;

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
    userRole: string
  ): Promise<Medication> {
    this.checkAdminAccess(userRole);
    
    const requestId = this.cls.get('requestId');
    this.logger.log(`Creating medication ${data.name}`, { requestId });

    const medication = await this.medicationRepository.createMedication({
      name: data.name,
      dosage: data.dosage,
      unit: data.unit,
      instructions: data.instructions,
    });

    await this.medicationRepository.createMedicationAudit({
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
    userRole: string
  ): Promise<Prescription> {
    this.checkAdminAccess(userRole);
    
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

    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : null;
    const schedulingWindow = this.getPrescriptionSchedulingWindow(startDate, endDate);
    const visitCandidates = schedulingWindow
      ? await this.medicationRepository.findVisitsForClientInRange(
          data.clientId,
          schedulingWindow.start,
          schedulingWindow.end
        )
      : [];
    const scheduledAdministrations = this.buildScheduledAdministrations(
      {
        startDate,
        endDate,
        frequencyPerDay: data.frequencyPerDay,
        frequencyIntervalHours: data.frequencyIntervalHours,
        administrationTimes: data.administrationTimes,
      },
      visitCandidates
    );

    const prescription = await this.medicationRepository.createPrescriptionWithSchedule({
      prescription: {
        client: { connect: { id: data.clientId } },
        medication: { connect: { id: data.medicationId } },
        start_date: startDate,
        end_date: endDate,
        frequency_per_day: data.frequencyPerDay,
        frequency_interval_hours: data.frequencyIntervalHours,
        administration_times: data.administrationTimes,
        special_instructions: data.specialInstructions,
        is_active: data.isActive ?? true,
      },
      administrations: scheduledAdministrations,
      actorId: userId,
      actorRole: userRole,
      auditChanges: {
        ...data,
        generatedAdministrationCount: scheduledAdministrations.length,
      },
    });

    this.logger.log(
      `Prescription ${prescription.id} created with ${scheduledAdministrations.length} scheduled administrations`,
      { requestId }
    );

    return prescription;
  }

  async updatePrescription(
    data: UpdatePrescriptionInput,
    userId: string,
    userRole: string
  ): Promise<Prescription> {
    this.checkAdminAccess(userRole);

    const requestId = this.cls.get('requestId');
    this.logger.log(`Updating prescription ${data.id}`, { requestId });

    const existingPrescription = await this.medicationRepository.findPrescriptionById(data.id);
    if (!existingPrescription) {
      throw new BaseHttpException(
        ErrorCode.PRESCRIPTION_NOT_FOUND,
        'Prescription not found',
        HttpStatus.NOT_FOUND
      );
    }

    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : null;

    this.validatePrescriptionDates(startDate, endDate);

    const normalizedAdministrationTimes = this.normalizeAdministrationTimes(
      data.administrationTimes,
      data.frequencyPerDay,
      data.frequencyIntervalHours
    );
    const now = new Date();
    const previousSchedule = this.buildPrescriptionScheduleSnapshot(existingPrescription);
    const nextSchedule: PrescriptionScheduleSnapshot = {
      startDate: startDate.toISOString(),
      endDate: endDate ? endDate.toISOString() : null,
      frequencyPerDay: data.frequencyPerDay,
      frequencyIntervalHours: data.frequencyIntervalHours ?? null,
      administrationTimes: normalizedAdministrationTimes,
      isActive: data.isActive,
    };
    const shouldReconcileFutureSchedule = this.hasFutureScheduleImpact(previousSchedule, nextSchedule);

    let scheduledAdministrations: ScheduledAdministrationDraft[] = [];
    if (shouldReconcileFutureSchedule && data.isActive) {
      const schedulingWindow = this.getPrescriptionSchedulingWindow(startDate, endDate, now);
      const visitCandidates = schedulingWindow
        ? await this.medicationRepository.findVisitsForClientInRange(
            existingPrescription.client_id,
            schedulingWindow.start,
            schedulingWindow.end
          )
        : [];

      scheduledAdministrations = this.buildScheduledAdministrations(
        {
          startDate,
          endDate,
          frequencyPerDay: data.frequencyPerDay,
          frequencyIntervalHours: data.frequencyIntervalHours,
          administrationTimes: normalizedAdministrationTimes,
        },
        visitCandidates,
        { minimumScheduledTime: now }
      );
    }

    const updatedPrescription = await this.medicationRepository.updatePrescriptionWithScheduleReconciliation({
      prescriptionId: existingPrescription.id,
      prescriptionData: {
        start_date: startDate,
        end_date: endDate,
        frequency_per_day: data.frequencyPerDay,
        frequency_interval_hours: data.frequencyIntervalHours,
        administration_times: normalizedAdministrationTimes,
        special_instructions: data.specialInstructions?.trim() || null,
        is_active: data.isActive,
      },
      cancelScheduledFrom: shouldReconcileFutureSchedule ? now : undefined,
      administrations: scheduledAdministrations,
      reconciliationReason: shouldReconcileFutureSchedule
        ? data.isActive
          ? 'Prescription schedule updated'
          : 'Prescription deactivated'
        : 'Prescription details updated',
      actorId: userId,
      actorRole: userRole,
      auditChanges: {
        previous: {
          ...previousSchedule,
          specialInstructions: existingPrescription.special_instructions ?? null,
        },
        next: {
          ...nextSchedule,
          specialInstructions: data.specialInstructions?.trim() || null,
        },
      },
    });

    this.logger.log(
      `Prescription ${updatedPrescription.id} updated with ${scheduledAdministrations.length} future administrations regenerated`,
      { requestId }
    );

    return updatedPrescription;
  }

  async reconcileMedicationAdministrationsForVisitWindow(
    clientId: string,
    scheduledStart: Date,
    scheduledEnd: Date
  ): Promise<void> {
    const requestId = this.cls.get('requestId');
    const { start, end } = this.expandToUtcDayRange(scheduledStart, scheduledEnd);

    const [visitCandidates, administrations] = await Promise.all([
      this.medicationRepository.findVisitsForClientInRange(clientId, start, end),
      this.medicationRepository.findScheduledMedicationAdministrationsForClientInRange(
        clientId,
        start,
        end
      ),
    ]);

    const updates = administrations.filter((administration) => {
      const matchedVisit = this.selectBestVisitForScheduledTime(
        visitCandidates,
        administration.scheduled_time
      );

      return (administration.visit_id ?? null) !== (matchedVisit?.id ?? null);
    });

    if (!updates.length) {
      this.logger.log(
        `No medication administration relinking needed for client ${clientId}`,
        { requestId }
      );
      return;
    }

    await Promise.all(
      updates.map((administration) => {
        const matchedVisit = this.selectBestVisitForScheduledTime(
          visitCandidates,
          administration.scheduled_time
        );

        return this.medicationRepository.updateMedicationAdministration(administration.id, {
          visit: matchedVisit
            ? { connect: { id: matchedVisit.id } }
            : { disconnect: true },
        });
      })
    );

    this.logger.log(
      `Relinked ${updates.length} medication administrations for client ${clientId}`,
      { requestId }
    );
  }

  async listDueMeds(
    visitId: string,
    userId: string,
    userRole: string
  ): Promise<any[]> {
    const requestId = this.cls.get('requestId');
    this.logger.log(`Fetching due medications for visit ${visitId}`, { requestId });

    // Check if user has access to this visit (implement similar to visit service)
    const dueMeds = await this.medicationRepository.findDueMedicationsForVisit(visitId);
    
    // Role-based filtering if needed
    if (userRole === 'carer') {
      // Ensure carer is assigned to this visit
      const visitMeds = dueMeds.filter(med => 
        med.visit && med.visit.carer_id === userId
      );
      return visitMeds;
    }

    return dueMeds;
  }

  async listVisitMedications(
    visitId: string,
    userId: string,
    userRole: string
  ): Promise<any[]> {
    const requestId = this.cls.get('requestId');
    this.logger.log(`Fetching all visit medications for visit ${visitId}`, { requestId });

    const visitMeds = await this.medicationRepository.findVisitMedications(visitId);

    if (userRole === 'carer') {
      return visitMeds.filter((med) => med.visit && med.visit.carer_id === userId);
    }

    return visitMeds;
  }

  async recordAdministration(
    data: RecordAdministrationInput,
    userId: string,
    userRole: string
  ): Promise<MedicationAdministration> {
    const requestId = this.cls.get('requestId');
    this.logger.log(`Recording medication administration ${data.administrationId}`, { requestId });

    const administration = await this.medicationRepository.findMedicationAdministrationById(data.administrationId);
    if (!administration) {
      throw new BaseHttpException(
        ErrorCode.MEDICATION_ADMINISTRATION_NOT_FOUND,
        'Medication administration record not found',
        HttpStatus.NOT_FOUND
      );
    }

    // Check permissions - carer must be assigned to the visit
    if (userRole === 'carer' && (administration as any).visit?.carer_id !== userId) {
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
        30 // 30-minute window
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
      {
        status: data.status,
        administered_time: data.status === MedicationStatus.ADMINISTERED ? new Date() : null,
        administered_by: data.status === MedicationStatus.ADMINISTERED ? userId : null,
        notes: data.notes || administration.notes,
      }
    );

    await this.medicationRepository.createMedicationAudit({
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
    userRole: string
  ): Promise<MedicationAdministration[]> {
    if (Number.isNaN(date.getTime())) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'A valid medication date is required',
        HttpStatus.BAD_REQUEST
      );
    }
    
    const requestId = this.cls.get('requestId');
    this.logger.log(`Fetching today's medications for date ${date.toISOString()}`, { requestId });

    const normalizedRole = typeof userRole === 'string' ? userRole.toLowerCase() : '';
    if (!['admin', 'office', 'carer'].includes(normalizedRole)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OFFICE_ACCESS,
        'Admin, office, or carer access required',
        HttpStatus.FORBIDDEN
      );
    }

    const administrations = await this.medicationRepository.findTodaysMedicationsByClient(
      date,
      normalizedRole === 'carer' ? { carerId: userId } : {}
    );

    return administrations.filter((administration) => {
      const hasRequiredRelations =
        Boolean((administration as any).prescription?.client) &&
        Boolean((administration as any).prescription?.medication);

      if (!hasRequiredRelations) {
        this.logger.warn(
          `Skipping incomplete medication administration ${administration.id}`,
          { requestId }
        );
      }

      return hasRequiredRelations;
    });
  }

  async findMedications(
    filter: MedicationFilterArgs,
    userId: string,
    userRole: string
  ): Promise<{ items: Medication[]; total: number }> {
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

  async findClientPrescriptions(
    filter: ClientPrescriptionFilter,
    userId: string,
    userRole: string
  ): Promise<Prescription[]> {
    this.checkAdminAccess(userRole);

    const requestId = this.cls.get('requestId');
    const where: any = {
      client_id: filter.clientId,
    };

    if (typeof filter.activeOnly === 'boolean') {
      where.is_active = filter.activeOnly;
    }

    this.logger.log(`Finding prescriptions for client ${filter.clientId}`, { requestId, where });

    const result = await this.medicationRepository.findPrescriptions({
      where,
      orderBy: { start_date: 'desc' },
    });

    return result.items;
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

  private checkOfficeAccess(userRole: string): void {
    if (!['admin', 'office'].includes(userRole)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OFFICE_ACCESS,
        'Office or admin access required',
        HttpStatus.FORBIDDEN
      );
    }
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

  private buildScheduledAdministrations(
    prescription: Pick<
      CreatePrescriptionInput,
      'administrationTimes' | 'frequencyPerDay' | 'frequencyIntervalHours'
    > & {
      startDate: Date;
      endDate: Date | null;
    },
    visitCandidates: Visit[],
    options?: {
      minimumScheduledTime?: Date;
    }
  ): ScheduledAdministrationDraft[] {
    const schedulingWindow = this.getPrescriptionSchedulingWindow(
      prescription.startDate,
      prescription.endDate,
      options?.minimumScheduledTime
    );

    if (!schedulingWindow) {
      return [];
    }

    const administrationTimes = this.normalizeAdministrationTimes(
      prescription.administrationTimes,
      prescription.frequencyPerDay,
      prescription.frequencyIntervalHours
    );

    if (!administrationTimes.length) {
      return [];
    }

    const drafts: ScheduledAdministrationDraft[] = [];

    for (
      let cursor = new Date(schedulingWindow.start);
      cursor <= schedulingWindow.end;
      cursor = this.addUtcDays(cursor, 1)
    ) {
      for (const administrationTime of administrationTimes) {
        const scheduledTime = this.combineUtcDateAndTime(cursor, administrationTime);

        if (scheduledTime < prescription.startDate) {
          continue;
        }

        if (options?.minimumScheduledTime && scheduledTime < options.minimumScheduledTime) {
          continue;
        }

        if (prescription.endDate && scheduledTime > prescription.endDate) {
          continue;
        }

        drafts.push({
          scheduledTime,
          visitId: this.selectBestVisitForScheduledTime(visitCandidates, scheduledTime)?.id ?? null,
        });
      }
    }

    return drafts;
  }

  private getPrescriptionSchedulingWindow(
    startDate: Date,
    endDate: Date | null,
    minimumScheduledTime?: Date
  ): MedicationSchedulingWindow | null {
    const minimumDate = minimumScheduledTime ?? new Date();
    const today = this.startOfUtcDay(new Date());
    const horizonEnd = this.endOfUtcDay(this.addUtcDays(today, PRESCRIPTION_SCHEDULING_HORIZON_DAYS));
    const rangeStart = this.maxDate(this.startOfUtcDay(startDate), this.startOfUtcDay(minimumDate));
    const rangeEnd = this.minDate(endDate ? this.endOfUtcDay(endDate) : horizonEnd, horizonEnd);

    if (rangeEnd < rangeStart) {
      return null;
    }

    return { start: rangeStart, end: rangeEnd };
  }

  private normalizeAdministrationTimes(
    administrationTimes: string[],
    frequencyPerDay: number,
    frequencyIntervalHours?: number
  ): string[] {
    const normalizedTimes = Array.from(
      new Set(
        (administrationTimes ?? [])
          .map((value) => value.trim())
          .filter((value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value))
      )
    ).sort();

    if (normalizedTimes.length > 0) {
      return normalizedTimes;
    }

    const totalAdministrations = Math.max(1, Math.min(frequencyPerDay || 1, 12));
    const intervalHours =
      frequencyIntervalHours && frequencyIntervalHours > 0
        ? frequencyIntervalHours
        : Math.max(1, Math.floor(24 / totalAdministrations));
    const fallbackStartHour = 8;

    return Array.from({ length: totalAdministrations }, (_, index) => {
      const hour = (fallbackStartHour + index * intervalHours) % 24;
      return `${String(hour).padStart(2, '0')}:00`;
    });
  }

  private validatePrescriptionDates(startDate: Date, endDate: Date | null): void {
    if (Number.isNaN(startDate.getTime())) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Prescription start date is invalid',
        HttpStatus.BAD_REQUEST
      );
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Prescription end date is invalid',
        HttpStatus.BAD_REQUEST
      );
    }

    if (endDate && endDate < startDate) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Prescription end date must be after the start date',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private buildPrescriptionScheduleSnapshot(
    prescription: Pick<
      Prescription,
      | 'start_date'
      | 'end_date'
      | 'frequency_per_day'
      | 'frequency_interval_hours'
      | 'administration_times'
      | 'is_active'
    >
  ): PrescriptionScheduleSnapshot {
    return {
      startDate: prescription.start_date.toISOString(),
      endDate: prescription.end_date ? prescription.end_date.toISOString() : null,
      frequencyPerDay: prescription.frequency_per_day,
      frequencyIntervalHours: prescription.frequency_interval_hours ?? null,
      administrationTimes: this.normalizeAdministrationTimes(
        prescription.administration_times,
        prescription.frequency_per_day,
        prescription.frequency_interval_hours ?? undefined
      ),
      isActive: prescription.is_active,
    };
  }

  private hasFutureScheduleImpact(
    previous: PrescriptionScheduleSnapshot,
    next: PrescriptionScheduleSnapshot
  ): boolean {
    return JSON.stringify(previous) !== JSON.stringify(next);
  }

  private selectBestVisitForScheduledTime(
    visits: Visit[],
    scheduledTime: Date
  ): Visit | null {
    let bestMatch: { visit: Visit; distanceMs: number } | null = null;

    for (const visit of visits) {
      if (!this.isVisitRelevantForScheduledTime(visit, scheduledTime)) {
        continue;
      }

      const distanceMs = this.getVisitDistanceMs(visit, scheduledTime);
      if (distanceMs > VISIT_MATCH_MAX_DISTANCE_MS) {
        continue;
      }

      if (
        !bestMatch ||
        distanceMs < bestMatch.distanceMs ||
        (distanceMs === bestMatch.distanceMs &&
          visit.scheduled_start.getTime() < bestMatch.visit.scheduled_start.getTime())
      ) {
        bestMatch = { visit, distanceMs };
      }
    }

    return bestMatch?.visit ?? null;
  }

  private isVisitRelevantForScheduledTime(visit: Visit, scheduledTime: Date): boolean {
    if (scheduledTime >= visit.scheduled_start && scheduledTime <= visit.scheduled_end) {
      return true;
    }

    return this.getUtcDateKey(visit.scheduled_start) === this.getUtcDateKey(scheduledTime);
  }

  private getVisitDistanceMs(visit: Visit, scheduledTime: Date): number {
    const scheduledTimestamp = scheduledTime.getTime();
    const visitStart = visit.scheduled_start.getTime();
    const visitEnd = visit.scheduled_end.getTime();

    if (scheduledTimestamp >= visitStart && scheduledTimestamp <= visitEnd) {
      return 0;
    }

    if (scheduledTimestamp < visitStart) {
      return visitStart - scheduledTimestamp;
    }

    return scheduledTimestamp - visitEnd;
  }

  private expandToUtcDayRange(start: Date, end: Date): MedicationSchedulingWindow {
    const earlier = start.getTime() <= end.getTime() ? start : end;
    const later = start.getTime() <= end.getTime() ? end : start;

    return {
      start: this.startOfUtcDay(earlier),
      end: this.endOfUtcDay(later),
    };
  }

  private combineUtcDateAndTime(day: Date, time: string): Date {
    const [hour, minute] = time.split(':').map(Number);
    const result = new Date(day);
    result.setUTCHours(hour, minute, 0, 0);
    return result;
  }

  private addUtcDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private startOfUtcDay(date: Date): Date {
    const result = new Date(date);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  private endOfUtcDay(date: Date): Date {
    const result = new Date(date);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }

  private getUtcDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private maxDate(left: Date, right: Date): Date {
    return left.getTime() >= right.getTime() ? left : right;
  }

  private minDate(left: Date, right: Date): Date {
    return left.getTime() <= right.getTime() ? left : right;
  }
}
