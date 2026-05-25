import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ShiftVerificationMethod } from '@oasis/db';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { ClockInInput } from './dto/clock-in.input';
import { ClockOutInput } from './dto/clock-out.input';
import { CarerShiftDto, ShiftAnalyticsDto, ShiftMethodBreakdownDto } from './dto/carer-shift.dto';
import { ShiftRepository } from './shift.repository';

@Injectable()
export class ShiftService {
  private readonly logger = new Logger(ShiftService.name);

  constructor(
    private readonly shiftRepository: ShiftRepository,
  ) {}

  async myActiveShift(userId: string, userRole: string, organizationId?: string): Promise<CarerShiftDto | null> {
    const orgId = await this.requireOrganizationId(organizationId);
    const role = this.normalizeRole(userRole);
    this.checkShiftReadAccess(role);

    const shift = await this.shiftRepository.findActiveShiftByCarerId(userId, orgId);
    if (!shift) return null;
    return this.mapShiftToDto(shift);
  }

  async myRecentShifts(userId: string, userRole: string, organizationId?: string, take = 5): Promise<CarerShiftDto[]> {
    const orgId = await this.requireOrganizationId(organizationId);
    const role = this.normalizeRole(userRole);
    this.checkShiftReadAccess(role);

    const shifts = await this.shiftRepository.findRecentShiftsByCarerId(userId, orgId, take);
    return shifts.map((shift) => this.mapShiftToDto(shift));
  }

  async clockIn(input: ClockInInput, userId: string, userRole: string, organizationId?: string): Promise<CarerShiftDto> {
    const orgId = await this.requireOrganizationId(organizationId);
    const role = this.normalizeRole(userRole);
    this.checkClockActionAccess(role);

    const carer = await this.shiftRepository.findCarerById(userId, orgId);
    if (!carer) {
      throw new BaseHttpException(
        ErrorCode.CARER_PROFILE_NOT_FOUND,
        'Carer profile not found. Ask an administrator to upsert your carer profile.',
        HttpStatus.NOT_FOUND,
      );
    }

    const activeShift = await this.shiftRepository.findActiveShiftByCarerId(userId, orgId);
    if (activeShift) {
      throw new BaseHttpException(
        ErrorCode.SHIFT_ALREADY_ACTIVE,
        'You are already clocked in.',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.shiftRepository.createShift({
      organizationId: orgId,
      carerId: userId,
      clockInMethod: input.method,
      clockInLat: input.latitude ?? null,
      clockInLng: input.longitude ?? null,
      clockInAccuracyM: input.accuracyMeters ?? null,
      clockInSource: input.source ?? 'web',
      clockInReasonCode: input.reasonCode ?? null,
      locationConsentAt: new Date(),
      notes: input.notes ?? null,
    });

    this.logger.log(`Carer ${userId} clocked in via ${input.method}`);
    return this.mapShiftToDto(created);
  }

  async clockOut(input: ClockOutInput, userId: string, userRole: string, organizationId?: string): Promise<CarerShiftDto> {
    const orgId = await this.requireOrganizationId(organizationId);
    const role = this.normalizeRole(userRole);
    this.checkClockActionAccess(role);

    const activeShift = await this.shiftRepository.findActiveShiftByCarerId(userId, orgId);
    if (!activeShift) {
      throw new BaseHttpException(
        ErrorCode.SHIFT_NOT_ACTIVE,
        'No active shift found. Clock in first.',
        HttpStatus.CONFLICT,
      );
    }

    const closed = await this.shiftRepository.closeShift(activeShift.id, {
      clockOutMethod: input.method,
      clockOutLat: input.latitude ?? null,
      clockOutLng: input.longitude ?? null,
      clockOutAccuracyM: input.accuracyMeters ?? null,
      clockOutSource: input.source ?? 'web',
      clockOutReasonCode: input.reasonCode ?? null,
      notes: input.notes ?? activeShift.notes ?? null,
    }, orgId);
    if (!closed) {
      throw new BaseHttpException(
        ErrorCode.SHIFT_NOT_ACTIVE,
        'No active shift found. Clock in first.',
        HttpStatus.CONFLICT,
      );
    }

    this.logger.log(`Carer ${userId} clocked out via ${input.method}`);
    return this.mapShiftToDto(closed);
  }

  async analytics(from?: string, to?: string, organizationId?: string): Promise<ShiftAnalyticsDto> {
    const orgId = await this.requireOrganizationId(organizationId);
    const range = this.getRange(from, to);

    const [
      activeCarersNow,
      openShiftCount,
      clockIns,
      clockOuts,
      closedShifts,
      clockInMethods,
      clockOutMethods,
    ] = await Promise.all([
      this.shiftRepository.countActiveShifts(orgId),
      this.shiftRepository.countActiveShifts(orgId),
      this.shiftRepository.countClockInsBetween(range.from, range.to, orgId),
      this.shiftRepository.countClockOutsBetween(range.from, range.to, orgId),
      this.shiftRepository.findClosedShiftsBetween(range.from, range.to, orgId),
      this.getMethodBreakdown(range.from, range.to, 'in', orgId),
      this.getMethodBreakdown(range.from, range.to, 'out', orgId),
    ]);

    const averageShiftMinutes = this.calculateAverageShiftMinutes(closedShifts);

    return {
      activeCarersNow,
      openShiftCount,
      clockIns,
      clockOuts,
      averageShiftMinutes,
      clockInMethods,
      clockOutMethods,
    };
  }

  private async getMethodBreakdown(
    from: Date,
    to: Date,
    direction: 'in' | 'out',
    organizationId: string,
  ): Promise<ShiftMethodBreakdownDto> {
    const countByMethod = async (method: ShiftVerificationMethod) => {
      if (direction === 'in') {
        return this.shiftRepository.countByClockInMethodBetween(from, to, method, organizationId);
      }
      return this.shiftRepository.countByClockOutMethodBetween(from, to, method, organizationId);
    };

    const [gps, qr, nfc, phone, manual] = await Promise.all([
      countByMethod(ShiftVerificationMethod.GPS),
      countByMethod(ShiftVerificationMethod.QR),
      countByMethod(ShiftVerificationMethod.NFC),
      countByMethod(ShiftVerificationMethod.PHONE),
      countByMethod(ShiftVerificationMethod.MANUAL),
    ]);

    return { gps, qr, nfc, phone, manual };
  }

  private calculateAverageShiftMinutes(
    shifts: Array<{ clock_in_at: Date; clock_out_at: Date | null }>,
  ): number {
    if (shifts.length === 0) return 0;

    const totalMinutes = shifts.reduce((sum, shift) => {
      if (!shift.clock_out_at) return sum;
      const diffMs = shift.clock_out_at.getTime() - shift.clock_in_at.getTime();
      return sum + Math.max(0, diffMs / 60000);
    }, 0);

    return Math.round((totalMinutes / shifts.length) * 10) / 10;
  }

  private getRange(from?: string, to?: string): { from: Date; to: Date } {
    if (from && to) {
      return { from: new Date(from), to: new Date(to) };
    }

    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);

    return { from: start, to: end };
  }

  private normalizeRole(userRole: string): string {
    return (userRole || '').toLowerCase().trim();
  }

  private checkShiftReadAccess(userRole: string): void {
    if (!['admin', 'carer'].includes(userRole)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Clinical staff access required',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private checkClockActionAccess(userRole: string): void {
    if (userRole !== 'carer') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Only carers can clock in or out',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private mapShiftToDto(shift: any): CarerShiftDto {
    return {
      id: shift.id,
      carerId: shift.carer_id,
      clockInAt: shift.clock_in_at,
      clockOutAt: shift.clock_out_at,
      isActive: !shift.clock_out_at,
      clockInProof: {
        latitude: shift.clock_in_lat,
        longitude: shift.clock_in_lng,
        accuracyMeters: shift.clock_in_accuracy_m,
        method: shift.clock_in_method,
        source: shift.clock_in_source,
        reasonCode: shift.clock_in_reason_code,
      },
      clockOutProof: shift.clock_out_method
        ? {
            latitude: shift.clock_out_lat,
            longitude: shift.clock_out_lng,
            accuracyMeters: shift.clock_out_accuracy_m,
            method: shift.clock_out_method,
            source: shift.clock_out_source,
            reasonCode: shift.clock_out_reason_code,
          }
        : null,
      locationConsentAt: shift.location_consent_at,
      notes: shift.notes,
      createdAt: shift.created_at,
      updatedAt: shift.updated_at,
    };
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
