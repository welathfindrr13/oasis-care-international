import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import {
  INSPECTION_RECORD_CLIENT_QUERY,
  INSPECTION_RECORD_EXPORT_QUERY,
  RECORD_EVIDENCE_PACK_EXPORT_MUTATION,
} from '../lib/graphql/queries'
import { createInspectionRecordExportHandler } from './api/evidence-packs/[id]/export/handler'

function authContext(capabilities: string[]) {
  return {
    authenticated: true,
    accessToken: 'test-token',
    accessSnapshot: { capabilities },
  } as any
}

const pack = {
  id: 'pack-secret-id',
  clientId: 'client-secret-id',
  status: 'DRAFT',
  kind: 'INSPECTION',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-07-31T00:00:00.000Z',
  generatedAt: '2026-07-24T10:00:00.000Z',
  publishedAt: null,
  items: [
    {
      id: 'item-secret-id',
      sourceType: 'VISIT',
      occurredAt: '2026-07-20T10:00:00.000Z',
    },
  ],
}

test('inspection export denies non-admins before fetching, rendering, or auditing', async () => {
  let calls = 0
  const handler = createInspectionRecordExportHandler({
    getAuthContext: async () => authContext([]),
    executeGraphQL: async <T,>() => {
      calls += 1
      return { status: 500, body: null as T | null }
    },
    renderPdf: async () => {
      calls += 1
      return Buffer.from('not used')
    },
  })

  const response = await handler(
    new NextRequest('https://app.test/api/evidence-packs/pack/export'),
    { params: Promise.resolve({ id: 'pack-secret-id' }) },
  )

  assert.equal(response.status, 403)
  assert.equal(calls, 0)
})

test('inspection export uses the safe pack and client projections and audits once', async () => {
  const queries: string[] = []
  let renderCount = 0
  const handler = createInspectionRecordExportHandler({
    getAuthContext: async () => authContext(['TENANT_ADMIN']),
    executeGraphQL: async <T,>(_token: string, query: string) => {
      queries.push(query)
      if (query === INSPECTION_RECORD_EXPORT_QUERY) {
        return {
          status: 200,
          body: { getEvidencePack: pack } as T,
        }
      }
      if (query === INSPECTION_RECORD_CLIENT_QUERY) {
        return {
          status: 200,
          body: {
            client: {
              fullName: 'Synthetic Client',
            },
          } as T,
        }
      }
      assert.equal(query, RECORD_EVIDENCE_PACK_EXPORT_MUTATION)
      return { status: 200, body: { recordEvidencePackExport: {} } as T }
    },
    renderPdf: async (record) => {
      renderCount += 1
      assert.equal(record.clientName, 'Synthetic Client')
      assert.doesNotMatch(JSON.stringify(record), /secret-id/)
      return Buffer.from('safe-pdf')
    },
  })

  const response = await handler(
    new NextRequest('https://app.test/api/evidence-packs/pack/export'),
    { params: Promise.resolve({ id: 'pack-secret-id' }) },
  )

  assert.equal(response.status, 200)
  assert.equal(renderCount, 1)
  assert.deepEqual(queries, [
    INSPECTION_RECORD_EXPORT_QUERY,
    INSPECTION_RECORD_CLIENT_QUERY,
    RECORD_EVIDENCE_PACK_EXPORT_MUTATION,
  ])
  const disposition = response.headers.get('content-disposition') ?? ''
  assert.match(disposition, /oasis-inspection-records-/)
  assert.doesNotMatch(disposition, /pack-secret-id|client-secret-id/)
})

test('inspection export never audits when PDF rendering fails', async () => {
  const queries: string[] = []
  const handler = createInspectionRecordExportHandler({
    getAuthContext: async () => authContext(['TENANT_ADMIN']),
    executeGraphQL: async <T,>(_token: string, query: string) => {
      queries.push(query)
      if (query === INSPECTION_RECORD_EXPORT_QUERY) {
        return { status: 200, body: { getEvidencePack: pack } as T }
      }
      if (query === INSPECTION_RECORD_CLIENT_QUERY) {
        return {
          status: 200,
          body: {
            client: { fullName: 'Synthetic Client' },
          } as T,
        }
      }
      throw new Error('Audit must not run after render failure')
    },
    renderPdf: async () => {
      throw new Error('Synthetic render failure')
    },
  })

  const response = await handler(
    new NextRequest('https://app.test/api/evidence-packs/pack/export'),
    { params: Promise.resolve({ id: 'pack-secret-id' }) },
  )

  assert.equal(response.status, 500)
  assert.deepEqual(queries, [
    INSPECTION_RECORD_EXPORT_QUERY,
    INSPECTION_RECORD_CLIENT_QUERY,
  ])
})
