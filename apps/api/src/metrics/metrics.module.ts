import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
} from '@willsoto/nestjs-prometheus';
import { RolesGuard } from '@oasis/auth';
import { Controller, Get, UseGuards, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SetMetadata } from '@nestjs/common';
import { Response } from 'express';
import { register } from 'prom-client';

// Roles decorator
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => 
  SetMetadata('roles', roles);

// --- Controller exposes /metrics -------------
@Controller('metrics')
export class MetricsController {
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @Get()
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}

// --- Provider constants ----------------------
const visitOverlapCounterProvider = makeCounterProvider({
  name: 'visit_overlap_total',
  help: 'Number of visit‐overlap attempts rejected',
});

const visitsCreatedCounterProvider = makeCounterProvider({
  name: 'visits_created_total',
  help: 'Number of visits successfully created',
});

// --- Module ----------------------------------
@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  controllers: [MetricsController],
  providers: [
    visitOverlapCounterProvider,
    visitsCreatedCounterProvider,
  ],
  exports: [
    visitOverlapCounterProvider,
    visitsCreatedCounterProvider,
  ],
})
export class MetricsModule {}
