import { DynamicModule, Module } from '@nestjs/common';
import { MetricsModule } from './metrics.module';

const noOpCounter = {
  inc: (_v?: any, _n?: any) => {},
  labels: (..._args: any[]) => ({ inc: (_v?: any, _n?: any) => {} }),
};

@Module({})
export class MetricsDynamicModule {
  static register(enabled: boolean): DynamicModule {
    if (enabled) {
      return { 
        module: MetricsDynamicModule, 
        imports: [MetricsModule],
        exports: [MetricsModule],
        global: true
      };
    }
    const providers = [
      { provide: 'visit_overlap_total', useValue: noOpCounter },
      { provide: 'visits_created_total', useValue: noOpCounter },
    ];
    return { 
      module: MetricsDynamicModule, 
      providers, 
      exports: providers,
      global: true
    };
  }
}
