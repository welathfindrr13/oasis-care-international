import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { TodayStatsDto } from './dto/today-stats.dto';
import { SetMetadata } from '@nestjs/common';
import { Request } from 'express';
import { ApiRolesGuard } from '../auth/api-roles.guard';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => 
  SetMetadata('roles', roles);

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @UseGuards(ApiRolesGuard)
  @Roles('admin')
  @Get('today')
  async today(@Req() req: Request & { user?: { organizationId?: string } }): Promise<TodayStatsDto> {
    return this.statsService.getTodayStats(req.user?.organizationId);
  }
}
