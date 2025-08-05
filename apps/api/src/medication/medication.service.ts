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

    await this.medicationRepository.createMedicationAudit({
      prescriptionId: prescription.id,
      action: MedicationAuditAction.PRESCRIPTION_CREATED,
      actorId: userId,
      actorRole: userRole,
      changes: data
    });

    return prescription;
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
    this.checkOfficeAccess(userRole);
    
    const requestId = this.cls.get('requestId');
    this.logger.log(`Fetching today's medications for date ${date.toISOString()}`, { requestId });

    return this.medicationRepository.findTodaysMedicationsByClient(date);
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
}
