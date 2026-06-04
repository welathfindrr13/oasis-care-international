import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { Controller, Get, UseGuards, Res } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import { Response } from 'express';
import { register, Counter } from 'prom-client';
import { DbModule } from '@oasis/db';
import { ApiRolesGuard } from '../auth/api-roles.guard';

// Roles decorator
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => 
  SetMetadata('roles', roles);

// --- Controller exposes /metrics -------------
@Controller('metrics')
export class MetricsController {
  @UseGuards(ApiRolesGuard)
  @Roles('admin')
  @Get()
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}

const visitOverlapCounterProvider = {
  provide: 'visit_overlap_total',
  useFactory: () =>
    new Counter({
      name: 'visit_overlap_total',
      help: 'Number of visit-overlap attempts rejected',
    }),
};

const visitsCreatedCounterProvider = {
  provide: 'visits_created_total',
  useFactory: () =>
    new Counter({
      name: 'visits_created_total',
      help: 'Number of visits successfully created',
    }),
};

@Module({
  // Import Prometheus exactly once here
  imports: [PrometheusModule.register(), DbModule],
  controllers: [MetricsController],
  providers: [ApiRolesGuard, visitOverlapCounterProvider, visitsCreatedCounterProvider],
  exports: [visitOverlapCounterProvider, visitsCreatedCounterProvider],
})
export class MetricsModule {}
