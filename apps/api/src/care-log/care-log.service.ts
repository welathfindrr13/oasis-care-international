import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CareLog, CareLogCategory, MedicationStatus, Prisma, PrismaService } from '@oasis/db';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { CreateCareLogInput } from './dto/create-care-log.input';
import { CareLogFilterArgs } from './dto/care-log-filter.args';
import { CareLogRepository } from './care-log.repository';
import { MonthlyCareSummaryDTO } from './dto/monthly-care-summary.dto';

@Injectable()
export class CareLogService {
  private readonly logger = new Logger(CareLogService.name);

  constructor(
    private readonly careLogRepository: CareLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createCareLog(
    input: CreateCareLogInput,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<CareLog> {
    const role = this.normalizeRole(userRole);
    const orgId = await this.requireOrganizationId(organizationId);
    if (!['admin', 'carer'].includes(role)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Only carers and admins can create care logs',
        HttpStatus.FORBIDDEN,
      );
    }

    const actorCarerId = role === 'carer' ? userId : (input.carerId || userId);

    if (role === 'carer' && input.carerId && input.carerId !== userId) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'Carers can only create care logs for themselves',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.assertClientAccess(input.clientId, userId, role, orgId);

    const [clientExists, carerExists] = await Promise.all([
      this.prisma.client.findFirst({
        where: this.prisma.whereNotDeleted({ id: input.clientId, organization_id: orgId }),
        select: { id: true },
      }),
      this.prisma.carer.findFirst({
        where: this.prisma.whereNotDeleted({ id: actorCarerId, organization_id: orgId, is_active: true }),
        select: { id: true },
      }),
    ]);

    if (!clientExists) {
      throw new BaseHttpException(ErrorCode.CLIENT_NOT_FOUND, 'Client not found', HttpStatus.NOT_FOUND);
    }

    if (!carerExists) {
      throw new BaseHttpException(
        ErrorCode.CARER_PROFILE_NOT_FOUND,
        'Carer profile not found for this organization',
        HttpStatus.NOT_FOUND,
      );
    }

    if (input.visitId) {
      const visit = await this.prisma.visit.findFirst({
        where: this.prisma.whereNotDeleted({ id: input.visitId, organization_id: orgId, client_id: input.clientId }),
        select: { id: true, carer_id: true },
      });
      if (!visit) {
        throw new BaseHttpException(ErrorCode.VISIT_NOT_FOUND, 'Visit not found in organization', HttpStatus.NOT_FOUND);
      }
      if (role === 'carer' && visit.carer_id !== userId) {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
          'Carers can only log entries for their own visits',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    if (input.medicationAdministrationId) {
      const admin = await this.prisma.medicationAdministration.findFirst({
        where: {
          id: input.medicationAdministrationId,
          deleted_at: null,
          prescription: {
            client_id: input.clientId,
            deleted_at: null,
            client: { organization_id: orgId, deleted_at: null },
          },
        },
        select: { id: true },
      });
      if (!admin) {
        throw new BaseHttpException(
          ErrorCode.MEDICATION_ADMINISTRATION_NOT_FOUND,
          'Medication administration not found for this client',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const createData: Prisma.CareLogCreateInput = {
      organization: { connect: { id: orgId } },
      client: { connect: { id: input.clientId } },
      carer: { connect: { id: actorCarerId } },
      occurred_at: new Date(input.occurredAt),
      category: input.category,
      visit: input.visitId ? { connect: { id: input.visitId } } : undefined,
      medication_administration: input.medicationAdministrationId
        ? { connect: { id: input.medicationAdministrationId } }
        : undefined,
      notes: input.notes,
      urine_passed: input.urinePassed,
      bowel_movement: input.bowelMovement,
      stool_type: input.stoolType,
      continence_status: input.continenceStatus,
      assistance_level: input.assistanceLevel,
      meal_type: input.mealType,
      intake_amount: input.intakeAmount,
      fluid_ml: input.fluidMl,
      appetite: input.appetite,
      slept: input.slept,
      sleep_start: input.sleepStart ? new Date(input.sleepStart) : undefined,
      sleep_end: input.sleepEnd ? new Date(input.sleepEnd) : undefined,
      sleep_quality: input.sleepQuality,
      mood_level: input.moodLevel,
      agitation: input.agitation,
      confusion: input.confusion,
      pain_score: input.painScore,
      escalated: input.escalated ?? false,
      escalated_to: input.escalatedTo,
      escalated_at: input.escalatedAt ? new Date(input.escalatedAt) : undefined,
      source: input.source || 'web',
    };

    this.logger.log(`Creating care log`, {
      category: input.category,
      clientId: input.clientId,
      carerId: actorCarerId,
      role,
    });

    return this.careLogRepository.create(createData);
  }

  async listCareLogs(
    filter: CareLogFilterArgs,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<{ items: CareLog[]; total: number }> {
    const role = this.normalizeRole(userRole);
    const orgId = await this.requireOrganizationId(organizationId);

    if (!['admin', 'carer'].includes(role)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Care log access is restricted',
        HttpStatus.FORBIDDEN,
      );
    }

    if (filter.clientId) {
      await this.assertClientAccess(filter.clientId, userId, role, orgId);
    }

    const where: Prisma.CareLogWhereInput = {
      organization_id: orgId,
    };

    if (filter.clientId) where.client_id = filter.clientId;
    if (filter.carerId) where.carer_id = filter.carerId;
    if (filter.visitId) where.visit_id = filter.visitId;
    if (filter.category) where.category = filter.category as CareLogCategory;

    if (filter.occurredFrom || filter.occurredTo) {
      where.occurred_at = {};
      if (filter.occurredFrom) where.occurred_at.gte = new Date(filter.occurredFrom);
      if (filter.occurredTo) where.occurred_at.lte = new Date(filter.occurredTo);
    }

    if (role === 'carer') {
      where.carer_id = userId;
    }

    return this.careLogRepository.findMany({
      where,
      skip: filter.skip,
      take: filter.take || 20,
      orderBy: { occurred_at: 'desc' },
    });
  }

  async monthlyCareSummary(
    clientId: string,
    year: number,
    month: number,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<MonthlyCareSummaryDTO> {
    const role = this.normalizeRole(userRole);
    const orgId = await this.requireOrganizationId(organizationId);

    if (!['admin', 'carer'].includes(role)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Care summary access is restricted',
        HttpStatus.FORBIDDEN,
      );
    }

    if (month < 1 || month > 12) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Month must be between 1 and 12',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertClientAccess(clientId, userId, role, orgId);

    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEndExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const monthEnd = new Date(monthEndExclusive.getTime() - 1);

    const [logs, meds] = await Promise.all([
      this.prisma.careLog.findMany({
        where: this.prisma.whereNotDeleted({
          organization_id: orgId,
          client_id: clientId,
          occurred_at: { gte: monthStart, lt: monthEndExclusive },
        }),
        select: { category: true },
      }),
      this.prisma.medicationAdministration.findMany({
        where: {
          deleted_at: null,
          scheduled_time: { gte: monthStart, lt: monthEndExclusive },
          prescription: {
            client_id: clientId,
            deleted_at: null,
            client: { organization_id: orgId, deleted_at: null },
          },
        },
        select: { status: true },
      }),
    ]);

    const categories = Object.values(CareLogCategory) as CareLogCategory[];
    const byCategory = categories.map((category) => ({
      category,
      count: logs.filter((log) => log.category === category).length,
    }));

    const medication = {
      total: meds.length,
      scheduled: meds.filter((m) => m.status === MedicationStatus.SCHEDULED).length,
      administered: meds.filter((m) => m.status === MedicationStatus.ADMINISTERED).length,
      missed: meds.filter((m) => m.status === MedicationStatus.MISSED).length,
      refused: meds.filter((m) => m.status === MedicationStatus.REFUSED).length,
      cancelled: meds.filter((m) => m.status === MedicationStatus.CANCELLED).length,
    };

    const topCategory = byCategory.reduce(
      (max, current) => (current.count > max.count ? current : max),
      { category: CareLogCategory.OTHER, count: 0 },
    );

    const requiredPlanAreas: CareLogCategory[] = [
      CareLogCategory.TOILETING,
      CareLogCategory.NUTRITION,
      CareLogCategory.SLEEP,
      CareLogCategory.MOOD,
      CareLogCategory.MEDICATION,
    ];
    const missingAreas = requiredPlanAreas.filter(
      (area) => !byCategory.some((row) => row.category === area && row.count > 0),
    );

    const adherence = medication.total > 0
      ? Math.round((medication.administered / medication.total) * 100)
      : 0;

    const highlights: string[] = [
      `Total care logs recorded: ${logs.length}`,
      `Most logged category: ${topCategory.category.toLowerCase()} (${topCategory.count})`,
      `Medication adherence: ${adherence}% (${medication.administered}/${medication.total})`,
    ];
    if (missingAreas.length > 0) {
      highlights.push(
        `Missing care-plan areas this month: ${missingAreas.map((a) => a.toLowerCase()).join(', ')}`,
      );
    }

    return {
      monthStart,
      monthEnd,
      totalCareLogs: logs.length,
      byCategory,
      medication,
      highlights,
    };
  }

  private normalizeRole(userRole: string): string {
    return (userRole || '').toLowerCase().trim();
  }

  private async assertClientAccess(
    clientId: string,
    userId: string,
    userRole: string,
    organizationId: string,
  ): Promise<void> {
    if (userRole === 'admin') {
      return;
    }

    if (userRole === 'carer') {
      const assignment = await this.prisma.visit.findFirst({
        where: this.prisma.whereNotDeleted({
          organization_id: organizationId,
          client_id: clientId,
          carer_id: userId,
        }),
        select: { id: true },
      });

      if (!assignment) {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
          'Carers can only access logs for assigned clients',
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }

    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_ROLE_REQUIRED,
      'Care log access is restricted',
      HttpStatus.FORBIDDEN,
    );
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
}
