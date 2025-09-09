# Metrics Provider Code Map

## DI Issue Root Cause Identified

**Problem**: `visit_overlap_total` provider missing when `METRICS_ENABLED=true`

## Module Structure Analysis

### MetricsDynamicModule (Global)
- **Location**: `apps/api/src/metrics/metrics.dynamic.module.ts`
- **Role**: Conditional provider registration based on METRICS_ENABLED
- **Global**: ✅ `@Global()` decorator present

**When enabled=true:**
```typescript
// CREATES DUPLICATE PROVIDERS - THIS IS THE BUG!
const visitOverlapCounterProvider = makeCounterProvider({
  name: 'visit_overlap_total',  // Creates provider with token 'visit_overlap_total_COUNTER'
});
```

**When enabled=false:**
```typescript
// Correct no-op providers
{ provide: 'visit_overlap_total', useFactory: noOpFactory },
```

### MetricsModule (Static)
- **Location**: `apps/api/src/metrics/metrics.module.ts`
- **Role**: Always provides real Prometheus counters
- **Contains**: 
  - `PrometheusModule.register()` import
  - `visitOverlapCounterProvider` with `name: 'visit_overlap_total'`
  - Exports counter providers

### VisitModule 
- **Location**: `apps/api/src/visit/visit.module.ts`
- **Issue**: Does NOT import MetricsModule or MetricsDynamicModule
- **Dependency**: VisitService expects `@Inject('visit_overlap_total')`

### VisitService Constructor
```typescript
constructor(
  @Inject('visit_overlap_total') private readonly overlapCounter: Counter,
  @Inject('visits_created_total') private readonly createCounter: Counter,
)
```

## Root Cause

**The DI failure occurs because**:

1. `MetricsDynamicModule` when enabled=true **double-registers** providers:
   - First via `imports: [MetricsModule]` (provides tokens)
   - Then via `providers: [visitOverlapCounterProvider, visitsCreatedCounterProvider]` (duplicate providers)

2. `makeCounterProvider()` from `@willsoto/nestjs-prometheus` likely generates token like `'visit_overlap_total_COUNTER'`, not the raw string `'visit_overlap_total'` that VisitService expects.

3. When enabled=false, the no-op providers correctly use string tokens `'visit_overlap_total'`.

## Token Mismatch Evidence

- **Expected by VisitService**: `'visit_overlap_total'` (string)
- **Provided by makeCounterProvider**: `'visit_overlap_total_COUNTER'` (generated token)
- **Working in tests**: Manual `{ provide: 'visit_overlap_total', useValue: mockCounter }`

## Files Cross-Referenced

✅ **MetricsDynamicModule**: Conditional registration, @Global present  
✅ **MetricsModule**: Real providers, PrometheusModule imported  
✅ **AppModule**: Imports MetricsDynamicModule.register(enabled)  
❌ **VisitModule**: Missing metrics imports (relies on @Global)  
❌ **VisitService**: Expects string tokens, gets generated tokens  

## Fix Required

The enabled=true branch should NOT duplicate providers from MetricsModule - just import and re-export MetricsModule.
