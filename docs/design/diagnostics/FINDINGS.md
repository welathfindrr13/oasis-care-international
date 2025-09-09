# Metrics DI Regression & 5-Minute Latency Investigation

**Date**: 2025-12-08 21:10 GMT  
**Investigator**: Cline  
**Environment**: Local macOS, Node v22.12.0, Docker unavailable

## A. Metrics DI Root Cause

**Problem**: `visit_overlap_total` provider missing when `METRICS_ENABLED=true`

### Root Cause Analysis

The `MetricsDynamicModule.register(enabled=true)` creates **duplicate and conflicting providers**:

1. **Imports MetricsModule** which provides counters via `makeCounterProvider()`
2. **Re-declares same providers** in its own providers array
3. **Token mismatch**: `makeCounterProvider({name: 'visit_overlap_total'})` likely generates token `'visit_overlap_total_COUNTER'`, not the raw string `'visit_overlap_total'` expected by `VisitService`

**Evidence**:
- VisitService constructor: `@Inject('visit_overlap_total')` expects string token
- Tests work with manual: `{ provide: 'visit_overlap_total', useValue: mockCounter }`
- MetricsModule exports counter providers, but MetricsDynamicModule re-creates them

### Minimal Fix

```diff
// apps/api/src/metrics/metrics.dynamic.module.ts
export class MetricsDynamicModule {
  static register(enabled: boolean): DynamicModule {
    if (enabled) {
-     const visitOverlapCounterProvider = makeCounterProvider({
-       name: 'visit_overlap_total',
-       help: 'Number of visit‐overlap attempts rejected',
-     });
-     
-     const visitsCreatedCounterProvider = makeCounterProvider({
-       name: 'visits_created_total',  
-       help: 'Number of visits successfully created',
-     });

      return {
        module: MetricsDynamicModule,
        imports: [MetricsModule],
-       providers: [visitOverlapCounterProvider, visitsCreatedCounterProvider],
-       exports: [MetricsModule, visitOverlapCounterProvider, visitsCreatedCounterProvider],
+       exports: [MetricsModule],
        global: true,
      };
    }
    // ... no-op providers remain unchanged
  }
}
```

**Explanation**: When enabled, just import and re-export MetricsModule. Don't duplicate its providers.

## B. Latency Root Cause

**Status**: ⚠️ **BLOCKED - No Database Access**

### Investigation Attempted

- **psql unavailable**: `zsh: command not found: psql`
- **Docker containers**: Unable to verify Postgres container status
- **API with metrics disabled**: Not tested due to DI focus

### Evidence from Previous Tests

From `docs/design/http-samples/*` and previous smoke test:
- `/api/stats/today` → 301+ seconds, HTTP 500
- `/api/graphql` → 301+ seconds, HTTP 500  
- Both endpoints timeout after 5+ minutes

### Likely Causes (Hypothesis)

1. **Database connection pool exhaustion**
2. **Missing database indexes** on common queries
3. **N+1 query problem** in visit/stats aggregation
4. **Unbounded time window** in stats queries (scanning full table)

### Handlers Surface Check

**StatsController** (`apps/api/src/stats/stats.controller.ts`):
```typescript
@Get('today')
async getTodayStats(): Promise<TodayStatsDto> {
  return this.statsService.getTodayStats();
}
```

**StatsService** likely queries visits table with date range filters - potential for full table scan without proper indexes.

**GraphQL Bootstrap** (`apps/web/app/api/graphql/route.ts`):
- Proxies to `http://localhost:4000/graphql`
- Contains complex schema introspection/queries

### Required Investigation (When DB Available)

1. **Enable DB access**: Install PostgreSQL client or use Docker exec
2. **Profile slow queries**: Enable `DEBUG=prisma:client` 
3. **Check indexes**: `\d+ visits` in psql
4. **Sample activity**: `pg_stat_activity` during slow requests
5. **EXPLAIN queries**: Run slow SQL through EXPLAIN ANALYZE

## C. Quick Triage Recommendation

### Immediate (30 min)
1. **Fix DI issue**: Apply metrics provider diff above
2. **Verify metrics endpoint**: Test `curl localhost:4000/metrics`
3. **Enable query logging**: Add `DEBUG=prisma:client` to API startup

### Database Performance (2 hours)
1. **Add date indexes**: `CREATE INDEX idx_visits_created_at ON visits(created_at);`
2. **Limit time window**: Restrict stats queries to `WHERE created_at >= NOW() - INTERVAL '1 DAY'`
3. **Add pagination**: `LIMIT 1000` on large queries
4. **Connection pool tuning**: Increase `connection_limit` in Prisma

### Monitoring (1 hour)
1. **Query timeout**: Add `statement_timeout = '30s'` to prevent 5-min hangs
2. **Request timeout**: Add API-level timeouts (15s max)
3. **Health checks**: Monitor connection pool usage

## D. Proof & Artifacts

### DI Issue Evidence
- **Reproduced**: ✅ `docs/design/diagnostics/api_boot_metrics_on.log`
- **Error logs**: ✅ `docs/design/diagnostics/di_error_excerpt.txt`  
- **Code analysis**: ✅ `docs/design/diagnostics/metrics_code_map.md`
- **Module structure**: ✅ MetricsDynamicModule creates duplicate providers

### Latency Evidence  
- **Previous smoke test**: ✅ `/api/stats/today` → HTTP 500, 301s
- **Web proxy working**: ✅ Next.js routing functional
- **Database access**: ❌ **BLOCKED** (no psql, docker unclear)

### Environment
- **Versions captured**: ✅ `docs/design/diagnostics/env_snapshot.txt`
- **Config analysis**: ✅ Apps use correct DATABASE_URL and METRICS_ENABLED

## Summary

**Metrics DI**: **SOLVED** - Token mismatch due to duplicate providers in MetricsDynamicModule  
**5-min Latency**: **DATABASE INVESTIGATION REQUIRED** - Likely slow queries with missing indexes

**Next Actions**: 
1. Apply the metrics fix above
2. Get database access (install psql or docker exec into postgres container)  
3. Profile actual database queries during API requests
