# API end-to-end suite discovery

The Jest E2E configuration accepts both historical filename forms: `*.e2e.spec.ts` and `*.e2e-spec.ts`.
The unit Jest configuration excludes both forms so integration containers run only in the dedicated serial E2E job.

Two superseded files are explicitly ignored:

- `medication.e2e-spec.ts` used mocked Prisma rows and an obsolete authentication harness. Linked-carer medication GraphQL behavior is covered with real PostgreSQL in `visit.e2e.spec.ts`.
- `stats.e2e-spec.ts` is the obsolete predecessor of the maintained `stats.e2e.spec.ts` suite.
