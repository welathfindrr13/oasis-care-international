import { Module } from '@nestjs/common';

/**
 * Creates a minimal mock Counter that implements the prom-client Counter API
 * used by our services (inc() and labels() methods)
 */
const createMockCounter = () => ({
  inc: jest.fn(),
  labels: (...labelValues: string[]) => ({
    inc: jest.fn()
  })
});

/**
 * Test-only providers for all metric tokens used across the app.
 * Provides no-op implementations to avoid real Prometheus side effects in tests.
 */
export const MetricsTestingProviders = [
  {
    provide: 'visit_overlap_total',
    useValue: createMockCounter(),
  },
  {
    provide: 'visits_created_total', 
    useValue: createMockCounter(),
  },
  {
    provide: 'medication_administrations_total',
    useValue: createMockCounter(),
  },
  {
    provide: 'medication_overlaps_total',
    useValue: createMockCounter(),
  },
];

/**
 * Reusable testing module that provides mock implementations for all Prometheus
 * metric tokens used in the app. Import this in any test that uses AppModule
 * to avoid DI errors about missing metric providers.
 */
@Module({
  providers: MetricsTestingProviders,
  exports: MetricsTestingProviders,
})
export class MetricsTestingModule {}
