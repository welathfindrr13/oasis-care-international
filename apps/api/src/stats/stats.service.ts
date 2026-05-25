import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService, VisitStatus } from '@oasis/db';
import { TodayStatsDto } from './dto/today-stats.dto';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayStats(organizationId?: string): Promise<TodayStatsDto> {
    const orgId = await this.requireOrganizationId(organizationId);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDayExclusive = new Date(startOfDay);
    endOfDayExclusive.setUTCDate(endOfDayExclusive.getUTCDate() + 1);

    const [booked, finished] = await this.prisma.$transaction([
      this.prisma.visit.count({
        where: this.prisma.whereNotDeleted({
          organization_id: orgId,
          scheduled_start: { gte: startOfDay, lt: endOfDayExclusive },
        }),
      }),
      this.prisma.visit.count({
        where: this.prisma.whereNotDeleted({
          organization_id: orgId,
          scheduled_start: { gte: startOfDay, lt: endOfDayExclusive },
          status: VisitStatus.COMPLETED,
        }),
      }),
    ]);

    return { booked, finished };
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
