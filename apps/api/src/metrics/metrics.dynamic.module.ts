import { DynamicModule, Global, Module } from '@nestjs/common';
import { MetricsModule } from './metrics.module';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

type NoOp = { inc: (...args: any[]) => void; labels: (...args: any[]) => NoOp; reset?: () => void };

const noOpFactory = (): NoOp => ({
  inc: () => {},
  labels: () => noOpFactory(),
  reset: () => {},
});

@Global()
@Module({})
export class MetricsDynamicModule {
  static register(enabled: boolean): DynamicModule {
    if (enabled) {
      // Use the real metrics module (already imports PrometheusModule and exports providers)
      // We need to explicitly export the provider tokens for global access
      const visitOverlapCounterProvider = makeCounterProvider({
        name: 'visit_overlap_total',
        help: 'Number of visit‐overlap attempts rejected',
      });
      
      const visitsCreatedCounterProvider = makeCounterProvider({
        name: 'visits_created_total',  
        help: 'Number of visits successfully created',
      });

      return {
        module: MetricsDynamicModule,
        imports: [MetricsModule],
        providers: [visitOverlapCounterProvider, visitsCreatedCounterProvider],
        exports: [MetricsModule, visitOverlapCounterProvider, visitsCreatedCounterProvider],
        global: true,
      };
    }

    // Disabled: provide no-op counters with EXACT token names expected by VisitService
    const providers = [
      { provide: 'visit_overlap_total', useFactory: noOpFactory },
      { provide: 'visits_created_total', useFactory: noOpFactory },
    ];
    return {
      module: MetricsDynamicModule,
      providers,
      exports: providers,
      global: true,
    };
  }
}
