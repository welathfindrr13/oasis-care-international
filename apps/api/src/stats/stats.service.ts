import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@oasis/db';
import { TodayStatsDto } from './dto/today-stats.dto';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayStats(
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<TodayStatsDto> {
    const role = String(userRole || '').toLowerCase().trim();
    if (!['admin', 'carer'].includes(role)) {
      throw new ForbiddenException('Today stats are only available to admin and carer accounts');
    }

    const { startOfDay, endOfDay } = getLondonOperationalDayRange(new Date());
    const bookedWhere = this.buildVisitWhere({
      userId,
      role,
      organizationId,
      field: 'scheduled_start',
      startOfDay,
      endOfDay,
    });
    const finishedWhere = this.buildVisitWhere({
      userId,
      role,
      organizationId,
      field: 'actual_end',
      startOfDay,
      endOfDay,
    });

    const [booked, finished] = await Promise.all([
      this.prisma.visit.count({ where: bookedWhere }),
      this.prisma.visit.count({ where: finishedWhere }),
    ]);

    return { booked, finished };
  }

  private buildVisitWhere({
    userId,
    role,
    organizationId,
    field,
    startOfDay,
    endOfDay,
  }: {
    userId: string;
    role: string;
    organizationId?: string;
    field: 'scheduled_start' | 'actual_end';
    startOfDay: Date;
    endOfDay: Date;
  }): Prisma.VisitWhereInput {
    const where: Prisma.VisitWhereInput = {
      deleted_at: null,
      [field]: {
        gte: startOfDay,
        lt: endOfDay,
      },
    };

    if (role === 'carer') {
      where.carer_id = userId;
    }

    if (organizationId) {
      where.client = {
        organization_id: organizationId,
        deleted_at: null,
      };
    }

    return where;
  }
}

const LONDON_TIMEZONE = 'Europe/London';

function getLondonOperationalDayRange(reference: Date) {
  const londonDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);

  const year = Number(londonDateParts.find((part) => part.type === 'year')?.value);
  const month = Number(londonDateParts.find((part) => part.type === 'month')?.value);
  const day = Number(londonDateParts.find((part) => part.type === 'day')?.value);

  const startOfDay = toUtcForLondonMidnight(year, month, day);
  const endOfDay = toUtcForLondonMidnight(year, month, day + 1);

  return { startOfDay, endOfDay };
}

function toUtcForLondonMidnight(year: number, month: number, day: number) {
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const offsetLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIMEZONE,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(utcMidnight)
    .find((part) => part.type === 'timeZoneName')
    ?.value;

  const offsetMinutes = parseGmtOffsetToMinutes(offsetLabel);
  return new Date(utcMidnight.getTime() - offsetMinutes * 60_000);
}

function parseGmtOffsetToMinutes(label?: string) {
  if (!label || label === 'GMT') {
    return 0;
  }

  const match = label.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
}
