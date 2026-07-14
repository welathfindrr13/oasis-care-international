import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, ShiftVerificationMethod } from '@oasis/db';
import { assertTenantIdForSensitiveWrite } from '../common/tenant/tenant-ownership';

export type ShiftCloseRequestProof = {
  hmac: string;
  keyId: string;
  version: number;
};

@Injectable()
export class ShiftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCarerById(id: string, organizationId: string) {
    return this.prisma.carer.findFirst({
      where: this.prisma.whereNotDeleted({ id, is_active: true, organization_id: organizationId }),
      select: { id: true, first_name: true, last_name: true, email: true, is_active: true },
    });
  }

  async findActiveShiftByCarerId(carerId: string, organizationId: string) {
    return this.prisma.carerShift.findFirst({
      where: this.prisma.whereNotDeleted({
        organization_id: organizationId,
        carer_id: carerId,
        clock_out_at: null,
      }),
      orderBy: { clock_in_at: 'desc' },
    });
  }

  async findShiftByIdForCarer(shiftId: string, carerId: string, organizationId: string) {
    return this.prisma.carerShift.findFirst({
      where: this.prisma.whereNotDeleted({
        id: shiftId,
        organization_id: organizationId,
        carer_id: carerId,
      }),
    });
  }

  async findRecentShiftsByCarerId(carerId: string, organizationId: string, take = 5) {
    return this.prisma.carerShift.findMany({
      where: this.prisma.whereNotDeleted({ carer_id: carerId, organization_id: organizationId }),
      orderBy: { clock_in_at: 'desc' },
      take,
    });
  }

  async createShift(input: {
    organizationId: string;
    carerId: string;
    clockInMethod: ShiftVerificationMethod;
    clockInLat?: number | null;
    clockInLng?: number | null;
    clockInAccuracyM?: number | null;
    clockInSource?: string | null;
    clockInReasonCode?: string | null;
    locationConsentAt?: Date | null;
    notes?: string | null;
  }) {
    const organizationId = assertTenantIdForSensitiveWrite('CarerShift', input.organizationId);
    return this.prisma.carerShift.create({
      data: {
        organization: { connect: { id: organizationId } },
        carer: { connect: { id: input.carerId } },
        clock_in_at: new Date(),
        clock_in_method: input.clockInMethod,
        clock_in_lat: input.clockInLat,
        clock_in_lng: input.clockInLng,
        clock_in_accuracy_m: input.clockInAccuracyM,
        clock_in_source: input.clockInSource,
        clock_in_reason_code: input.clockInReasonCode,
        location_consent_at: input.locationConsentAt,
        notes: input.notes,
      },
    });
  }

  async closeShift(
    shiftId: string,
    input: {
      clockOutMethod: ShiftVerificationMethod;
      clockOutLat?: number | null;
      clockOutLng?: number | null;
      clockOutAccuracyM?: number | null;
      clockOutSource?: string | null;
      clockOutReasonCode?: string | null;
      notes?: string | null;
    },
    carerId: string,
    organizationId: string,
    audit: {
      authSubject: string;
      membershipId: string;
      actorRole: string;
      requestFingerprint: string;
      fingerprintKeyId: string;
      fingerprintVersion: number;
      notesProvided: boolean;
    },
  ) {
    return (this.prisma as any).$transaction(
      async (tx: Prisma.TransactionClient) => {
        const closedAt = new Date();
        const result = await tx.carerShift.updateMany({
          where: {
            id: shiftId,
            carer_id: carerId,
            organization_id: organizationId,
            clock_out_at: null,
            deleted_at: null,
          },
          data: {
            clock_out_at: closedAt,
            clock_out_method: input.clockOutMethod,
            clock_out_lat: input.clockOutLat,
            clock_out_lng: input.clockOutLng,
            clock_out_accuracy_m: input.clockOutAccuracyM,
            clock_out_source: input.clockOutSource,
            clock_out_reason_code: input.clockOutReasonCode,
            notes: input.notes,
          },
        });

        if (result.count === 1) {
          await tx.auditLog.create({
            data: {
              organization_id: organizationId,
              user_id: audit.authSubject,
              action: 'SHIFT_CLOCKED_OUT',
              resource_type: 'CarerShift',
              resource_id: shiftId,
              old_values: { state: 'OPEN' },
              new_values: {
                state: 'CLOSED',
                membershipId: audit.membershipId,
                actorRole: audit.actorRole,
                requestFingerprint: audit.requestFingerprint,
                fingerprintKeyId: audit.fingerprintKeyId,
                fingerprintVersion: audit.fingerprintVersion,
                notesProvided: audit.notesProvided,
              },
              timestamp: closedAt,
            },
          });
        }

        const shift = await tx.carerShift.findFirst({
          where: {
            id: shiftId,
            carer_id: carerId,
            organization_id: organizationId,
            deleted_at: null,
          },
        });
        if (result.count === 1) {
          return {
            applied: true,
            shift,
            requestProof: {
              hmac: audit.requestFingerprint,
              keyId: audit.fingerprintKeyId,
              version: audit.fingerprintVersion,
            } satisfies ShiftCloseRequestProof,
          };
        }

        const priorClose = await tx.auditLog.findFirst({
          where: {
            organization_id: organizationId,
            resource_type: 'CarerShift',
            resource_id: shiftId,
            action: 'SHIFT_CLOCKED_OUT',
          },
          orderBy: { timestamp: 'desc' },
          select: { new_values: true },
        });
        return {
          applied: false,
          shift,
          requestProof: this.closeRequestProof(priorClose?.new_values),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private closeRequestProof(
    value: Prisma.JsonValue | null | undefined,
  ): ShiftCloseRequestProof | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const metadata = value as Prisma.JsonObject;
    if (
      !Number.isInteger(metadata.fingerprintVersion) ||
      typeof metadata.fingerprintKeyId !== 'string' ||
      !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(metadata.fingerprintKeyId) ||
      typeof metadata.requestFingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(metadata.requestFingerprint)
    ) {
      return null;
    }
    return {
      hmac: metadata.requestFingerprint,
      keyId: metadata.fingerprintKeyId,
      version: metadata.fingerprintVersion as number,
    };
  }

  async countActiveShifts(organizationId: string) {
    return this.prisma.carerShift.count({
      where: this.prisma.whereNotDeleted({ clock_out_at: null, organization_id: organizationId }),
    });
  }

  async countClockInsBetween(from: Date, to: Date, organizationId: string) {
    return this.prisma.carerShift.count({
      where: this.prisma.whereNotDeleted({
        organization_id: organizationId,
        clock_in_at: { gte: from, lte: to },
      }),
    });
  }

  async countClockOutsBetween(from: Date, to: Date, organizationId: string) {
    return this.prisma.carerShift.count({
      where: this.prisma.whereNotDeleted({
        organization_id: organizationId,
        clock_out_at: { gte: from, lte: to },
      }),
    });
  }

  async countByClockInMethodBetween(
    from: Date,
    to: Date,
    method: ShiftVerificationMethod,
    organizationId: string,
  ) {
    return this.prisma.carerShift.count({
      where: this.prisma.whereNotDeleted({
        organization_id: organizationId,
        clock_in_at: { gte: from, lte: to },
        clock_in_method: method,
      }),
    });
  }

  async countByClockOutMethodBetween(
    from: Date,
    to: Date,
    method: ShiftVerificationMethod,
    organizationId: string,
  ) {
    return this.prisma.carerShift.count({
      where: this.prisma.whereNotDeleted({
        organization_id: organizationId,
        clock_out_at: { gte: from, lte: to },
        clock_out_method: method,
      }),
    });
  }

  async findClosedShiftsBetween(from: Date, to: Date, organizationId: string) {
    return this.prisma.carerShift.findMany({
      where: this.prisma.whereNotDeleted({
        organization_id: organizationId,
        clock_in_at: { gte: from, lte: to },
        clock_out_at: { not: null },
      }),
      select: {
        clock_in_at: true,
        clock_out_at: true,
      },
    });
  }
}
