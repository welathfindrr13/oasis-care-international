import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { TodayStatsDto } from './dto/today-stats.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@oasis/auth';
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => 
  SetMetadata('roles', roles);

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'carer')
  @Get('today')
  async today(@Req() req: any): Promise<TodayStatsDto> {
    const user = req.user ?? {};
    return this.statsService.getTodayStats(
      user.sub || user.id,
      user.realm_access?.roles?.[0] || user.role || 'user',
      user.organizationId,
    );
  }
}
