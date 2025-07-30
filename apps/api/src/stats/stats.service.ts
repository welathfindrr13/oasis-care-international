import { Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { TodayStatsDto } from './dto/today-stats.dto';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayStats(): Promise<TodayStatsDto> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [booked, finished] = await this.prisma.$transaction([
      this.prisma.visit.count({
        where: { created_at: { gte: startOfDay } },
      }),
      this.prisma.visit.count({
        where: { actual_end: { gte: startOfDay } },
      }),
    ]);

    return { booked, finished };
  }
}
