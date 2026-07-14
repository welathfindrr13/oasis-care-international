import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ShiftVerificationMethod } from '@oasis/db';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { ClockInInput } from './dto/clock-in.input';
import { ClockOutInput } from './dto/clock-out.input';
import { CarerShiftDto, ShiftAnalyticsDto, ShiftMethodBreakdownDto } from './dto/carer-shift.dto';
import { ShiftRepository, type ShiftCloseRequestProof } from './shift.repository';
import {
  loadShiftIdempotencyKeyRing,
  SHIFT_CLOCK_OUT_PROOF_VERSION,
  ShiftIdempotencyKeyRingConfigError,
  type ShiftIdempotencyKey,
  type ShiftIdempotencyKeyRing,
} from './shift-idempotency-keyring';
import {
  type AccessCapability,
  type CanonicalCapabilityActor,
  hasCanonicalActorCapability,
} from '../auth/access-capability';
import { organizationDayUtcRange } from '@oasis/time';

const CLOCK_OUT_FINGERPRINT_DOMAIN = 'oasis.shift.clock-out.idempotency';

@Injectable()
export class ShiftService {
  private readonly logger = new Logger(ShiftService.name);

  constructor(
    private readonly shiftRepository: ShiftRepository,
  ) {}

  async myActiveShift(userId: string, userRole: string, organizationId?: string, accessContext?: CanonicalCapabilityActor): Promise<CarerShiftDto | null> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.assertActorCapability(accessContext, 'FRONTLINE_SHIFT_VIEW', orgId, userId, userRole);

    const shift = await this.shiftRepository.findActiveShiftByCarerId(userId, orgId);
    if (!shift) return null;
    return this.mapShiftToDto(shift);
  }

  async myRecentShifts(userId: string, userRole: string, organizationId?: string, take = 5, accessContext?: CanonicalCapabilityActor): Promise<CarerShiftDto[]> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.assertActorCapability(accessContext, 'FRONTLINE_SHIFT_VIEW', orgId, userId, userRole);

    const shifts = await this.shiftRepository.findRecentShiftsByCarerId(userId, orgId, take);
    return shifts.map((shift) => this.mapShiftToDto(shift));
  }

  async clockIn(input: ClockInInput, userId: string, userRole: string, organizationId?: string, accessContext?: CanonicalCapabilityActor): Promise<CarerShiftDto> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.assertActorCapability(accessContext, 'FRONTLINE_SHIFT_EXECUTE', orgId, userId, userRole);

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

    let created;
    try {
      created = await this.shiftRepository.createShift({
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
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new BaseHttpException(
          ErrorCode.SHIFT_ALREADY_ACTIVE,
          'You are already clocked in.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }

    this.logger.log(`Carer ${userId} clocked in via ${input.method}`);
    return this.mapShiftToDto(created);
  }

  async clockOut(input: ClockOutInput, userId: string, userRole: string, organizationId?: string, accessContext?: CanonicalCapabilityActor): Promise<CarerShiftDto> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.assertActorCapability(accessContext, 'FRONTLINE_SHIFT_EXECUTE', orgId, userId, userRole);

    const targetShift = await this.shiftRepository.findShiftByIdForCarer(
      input.shiftId,
      userId,
      orgId,
    );
    if (!targetShift) {
      this.throwShiftUnavailable();
    }

    const auditActor = this.requireAuditActor(accessContext);
    const notesProvided = Object.prototype.hasOwnProperty.call(input, 'notes');
    const requestedClose = this.normalizedClockOut(input, targetShift.notes);
    const keyRing = this.requireShiftIdempotencyKeyRing();
    const canonicalRequest = this.clockOutCanonicalRequest(input, notesProvided, {
      organizationId: orgId,
      carerId: userId,
      ...auditActor,
    });
    const requestProof = this.signClockOutRequest(canonicalRequest, keyRing.current);

    const closed = await this.shiftRepository.closeShift(
      targetShift.id,
      requestedClose,
      userId,
      orgId,
      {
        ...auditActor,
        requestFingerprint: requestProof.hmac,
        fingerprintKeyId: requestProof.keyId,
        fingerprintVersion: requestProof.version,
        notesProvided,
      },
    );
    if (!closed.shift) {
      this.throwShiftNotActive();
    }
    if (!this.verifyClockOutRequest(closed.requestProof, canonicalRequest, keyRing)) {
      this.throwClockOutConflict();
    }

    this.logger.log(`Carer ${userId} clocked out via ${input.method}`);
    return this.mapShiftToDto(closed.shift);
  }

  async analytics(from: string | undefined, to: string | undefined, userId: string, userRole: string, organizationId?: string, accessContext?: CanonicalCapabilityActor): Promise<ShiftAnalyticsDto> {
    const orgId = await this.requireOrganizationId(organizationId);
    this.assertActorCapability(accessContext, 'WORKFORCE_MANAGE', orgId, userId, userRole);
    const range = this.getRange(from, to, orgId);

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

  private normalizedClockOut(input: ClockOutInput, fallbackNotes: string | null) {
    return {
      clockOutMethod: input.method,
      clockOutLat: input.latitude ?? null,
      clockOutLng: input.longitude ?? null,
      clockOutAccuracyM: input.accuracyMeters ?? null,
      clockOutSource: input.source ?? 'web',
      clockOutReasonCode: input.reasonCode ?? null,
      notes: input.notes ?? fallbackNotes ?? null,
    };
  }

  private clockOutCanonicalRequest(
    input: ClockOutInput,
    notesProvided: boolean,
    actor: {
      organizationId: string;
      carerId: string;
      authSubject: string;
      membershipId: string;
      actorRole: string;
    },
  ): string {
    return JSON.stringify({
      domain: CLOCK_OUT_FINGERPRINT_DOMAIN,
      version: SHIFT_CLOCK_OUT_PROOF_VERSION,
      organizationId: actor.organizationId,
      carerId: actor.carerId,
      authSubject: actor.authSubject,
      membershipId: actor.membershipId,
      actorRole: actor.actorRole,
      shiftId: input.shiftId,
      method: input.method,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accuracyMeters: input.accuracyMeters ?? null,
      source: input.source ?? 'web',
      reasonCode: input.reasonCode ?? null,
      notes: {
        provided: notesProvided,
        value: notesProvided ? input.notes ?? null : null,
      },
    });
  }

  private signClockOutRequest(
    canonicalRequest: string,
    key: ShiftIdempotencyKey,
  ): ShiftCloseRequestProof {
    return {
      hmac: createHmac('sha256', key.secret).update(canonicalRequest).digest('hex'),
      keyId: key.id,
      version: SHIFT_CLOCK_OUT_PROOF_VERSION,
    };
  }

  private verifyClockOutRequest(
    persisted: ShiftCloseRequestProof | null | undefined,
    canonicalRequest: string,
    keyRing: ShiftIdempotencyKeyRing,
  ): boolean {
    if (!persisted || persisted.version !== SHIFT_CLOCK_OUT_PROOF_VERSION) return false;
    const verificationKey = keyRing.verificationKeys.get(persisted.keyId);
    if (!verificationKey) return false;
    const expected = this.signClockOutRequest(canonicalRequest, verificationKey);
    return this.requestFingerprintsEqual(persisted.hmac, expected.hmac);
  }

  private requireShiftIdempotencyKeyRing(): ShiftIdempotencyKeyRing {
    try {
      return loadShiftIdempotencyKeyRing();
    } catch (error) {
      if (!(error instanceof ShiftIdempotencyKeyRingConfigError)) throw error;
      throw new BaseHttpException(
        ErrorCode.INTERNAL_ERROR,
        'Shift request verification is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private requireAuditActor(accessContext: CanonicalCapabilityActor | undefined): {
    authSubject: string;
    membershipId: string;
    actorRole: string;
  } {
    const authSubject = accessContext?.authSubject?.trim();
    const membershipId = accessContext?.membershipId?.trim();
    const actorRole = this.normalizeActorRole(accessContext?.rawRole);
    if (!authSubject || !membershipId || !actorRole) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'This account cannot perform the requested shift action',
        HttpStatus.FORBIDDEN,
      );
    }
    return { authSubject, membershipId, actorRole };
  }

  private normalizeActorRole(role: string | null | undefined): string {
    const normalized = String(role || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    return normalized === 'staff' ? 'carer' : normalized;
  }

  private requestFingerprintsEqual(
    persisted: string | null | undefined,
    requested: string,
  ): boolean {
    if (!persisted || !/^[a-f0-9]{64}$/.test(persisted)) return false;
    const persistedBytes = Buffer.from(persisted, 'hex');
    const requestedBytes = Buffer.from(requested, 'hex');
    return (
      persistedBytes.length === requestedBytes.length &&
      timingSafeEqual(persistedBytes, requestedBytes)
    );
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
    );
  }

  private throwShiftNotActive(): never {
    throw new BaseHttpException(
      ErrorCode.SHIFT_NOT_ACTIVE,
      'No active shift found. Clock in first.',
      HttpStatus.CONFLICT,
    );
  }

  private throwShiftUnavailable(): never {
    throw new BaseHttpException(
      ErrorCode.SHIFT_NOT_ACTIVE,
      'The requested shift is unavailable for this account.',
      HttpStatus.CONFLICT,
    );
  }

  private throwClockOutConflict(): never {
    throw new BaseHttpException(
      ErrorCode.SHIFT_NOT_ACTIVE,
      'This shift was already clocked out with different proof or notes.',
      HttpStatus.CONFLICT,
    );
  }

  private getRange(from: string | undefined, to: string | undefined, organizationId: string): { from: Date; to: Date } {
    if (from && to) {
      return { from: new Date(from), to: new Date(to) };
    }

    const range = organizationDayUtcRange(new Date(), organizationId);
    return { from: range.start, to: new Date(range.end.getTime() - 1) };
  }

  private assertActorCapability(
    accessContext: CanonicalCapabilityActor | undefined,
    capability: AccessCapability,
    organizationId: string,
    userId: string,
    userRole: string,
  ): void {
    if (hasCanonicalActorCapability(accessContext, capability, { organizationId, userId, userRole })) return;
    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
      'This account cannot perform the requested shift action',
      HttpStatus.FORBIDDEN,
    );
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
