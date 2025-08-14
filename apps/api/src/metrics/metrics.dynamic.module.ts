import { Global, Module, DynamicModule } from '@nestjs/common';
import { MetricsModule } from './metrics.module';
import type { Counter } from 'prom-client';

@Global()
@Module({})
export class MetricsDynamicModule {
  static register(enabled: boolean): DynamicModule {
    if (enabled) {
      // When enabled, just use the real MetricsModule providers.
      return {
        module: MetricsDynamicModule,
        imports: [MetricsModule],
        exports: [MetricsModule],
        global: true,
      };
    }

    // When disabled, provide no-op counters under the SAME TOKENS.
    const noOp = (): Counter<string> =>
      ({
        inc: () => {},
        labels: () => noOp(),
      } as unknown as Counter<string>);

    return {
      module: MetricsDynamicModule,
      providers: [
        { provide: 'visit_overlap_total', useFactory: noOp },
        { provide: 'visits_created_total', useFactory: noOp },
      ],
      exports: ['visit_overlap_total', 'visits_created_total'],
      global: true,
    };
  }
}
