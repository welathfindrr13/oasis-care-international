import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInspectionRecordDocument,
  buildInspectionRecordItems,
  groupInspectionRecordItems,
  reconcileInspectionSourceSelections,
  shouldShowRequestedClientUnavailable,
  validateInspectionRecordForm,
} from './inspection-records'

test('inspection record items project permitted sources without raw content', () => {
  const items = buildInspectionRecordItems({
    assessments: [
      {
        id: 'assessment-1',
        title: 'Private assessment title',
        status: 'COMPLETED',
        completedAt: '2026-07-20T10:00:00.000Z',
        createdAt: '2026-07-19T10:00:00.000Z',
        findings: 'RAW_FINDINGS_SENTINEL',
      } as any,
    ],
    carePlans: [
      {
        id: 'plan-1',
        title: 'Private plan title',
        status: 'ACTIVE',
        version: 2,
        assessmentId: 'assessment-1',
        approvedAt: '2026-07-21T10:00:00.000Z',
        effectiveFrom: '2026-07-21T10:00:00.000Z',
        createdAt: '2026-07-20T10:00:00.000Z',
        safetyNotes: 'RAW_SAFETY_SENTINEL',
      } as any,
    ],
    operationalSources: [
      {
        id: 'visit-1',
        sourceType: 'VISIT',
        occurredAt: '2026-07-22T10:00:00.000Z',
        status: 'COMPLETED',
        title: 'RAW_TITLE_SENTINEL',
        subtitle: 'RAW_SUBTITLE_SENTINEL',
        createdBy: 'RAW_ACTOR_SENTINEL',
        previewText: 'RAW_PREVIEW_SENTINEL',
        detail: 'RAW_DETAIL_SENTINEL',
        metadata: { secret: 'RAW_METADATA_SENTINEL' },
      } as any,
    ],
  })

  assert.deepEqual(items, [
    {
      sourceType: 'ASSESSMENT',
      sourceId: 'assessment-1',
      occurredAt: '2026-07-20T10:00:00.000Z',
      headline: 'Assessment record',
    },
    {
      sourceType: 'CARE_PLAN',
      sourceId: 'plan-1',
      occurredAt: '2026-07-21T10:00:00.000Z',
      headline: 'Care plan version',
    },
    {
      sourceType: 'VISIT',
      sourceId: 'visit-1',
      occurredAt: '2026-07-22T10:00:00.000Z',
      headline: 'Visit record',
    },
  ])

  const serialized = JSON.stringify(items)
  for (const forbidden of [
    'Private assessment title',
    'Private plan title',
    'RAW_',
    'createdBy',
    'previewText',
    'detail',
    'metadata',
    'MANUAL_NOTE',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden))
  }
})

test('inspection record items reject medication, unknown, and duplicate sources', () => {
  const base = { assessments: [], carePlans: [] }
  assert.throws(
    () =>
      buildInspectionRecordItems({
        ...base,
        operationalSources: [
          {
            id: 'medication-1',
            sourceType: 'MEDICATION_ADMINISTRATION',
            occurredAt: '2026-07-22T10:00:00.000Z',
          },
        ] as any,
      }),
    /INSPECTION_RECORD_SOURCE_NOT_PERMITTED/,
  )
  assert.throws(
    () =>
      buildInspectionRecordItems({
        ...base,
        operationalSources: [
          {
            id: 'unknown-1',
            sourceType: 'UNKNOWN',
            occurredAt: '2026-07-22T10:00:00.000Z',
          },
        ] as any,
      }),
    /INSPECTION_RECORD_SOURCE_NOT_PERMITTED/,
  )
  assert.throws(
    () =>
      buildInspectionRecordItems({
        ...base,
        operationalSources: [
          {
            id: 'visit-1',
            sourceType: 'VISIT',
            occurredAt: '2026-07-22T10:00:00.000Z',
          },
          {
            id: 'visit-1',
            sourceType: 'VISIT',
            occurredAt: '2026-07-22T10:00:00.000Z',
          },
        ],
      }),
    /INSPECTION_RECORD_SOURCE_DUPLICATE/,
  )
})

test('inspection record groups count safe record types and date ranges', () => {
  assert.deepEqual(
    groupInspectionRecordItems([
      {
        sourceType: 'VISIT',
        occurredAt: '2026-07-22T10:00:00.000Z',
      },
      {
        sourceType: 'VISIT',
        occurredAt: '2026-07-20T10:00:00.000Z',
      },
      {
        sourceType: 'CARE_LOG',
        occurredAt: '2026-07-21T10:00:00.000Z',
      },
      {
        sourceType: 'MEDICATION_ADMINISTRATION',
        occurredAt: '2026-07-21T10:00:00.000Z',
      },
    ]),
    [
      {
        sourceType: 'VISIT',
        label: 'Visits',
        count: 2,
        firstOccurredAt: '2026-07-20T10:00:00.000Z',
        lastOccurredAt: '2026-07-22T10:00:00.000Z',
      },
      {
        sourceType: 'CARE_LOG',
        label: 'Care notes',
        count: 1,
        firstOccurredAt: '2026-07-21T10:00:00.000Z',
        lastOccurredAt: '2026-07-21T10:00:00.000Z',
      },
    ],
  )
})

test('inspection export document excludes identifiers and arbitrary pack fields', () => {
  const document = buildInspectionRecordDocument(
    {
      id: 'pack-secret-id',
      clientId: 'client-secret-id',
      carePlanId: 'plan-secret-id',
      status: 'DRAFT',
      kind: 'INSPECTION',
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-07-31T00:00:00.000Z',
      generatedAt: '2026-07-24T10:00:00.000Z',
      publishedAt: null,
      generatedBy: 'actor-secret-id',
      summary: { raw: 'RAW_SUMMARY_SENTINEL' },
      sourceRefs: { raw: 'RAW_SOURCE_REFS_SENTINEL' },
      items: [
        {
          id: 'item-secret-id',
          sourceType: 'CONCERN',
          occurredAt: '2026-07-23T10:00:00.000Z',
          detail: 'RAW_DETAIL_SENTINEL',
        },
      ],
    } as any,
    'Synthetic Client',
  )

  assert.deepEqual(document, {
    clientName: 'Synthetic Client',
    status: 'DRAFT',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T00:00:00.000Z',
    generatedAt: '2026-07-24T10:00:00.000Z',
    publishedAt: null,
    includedRecords: [
      {
        sourceType: 'CONCERN',
        label: 'Concerns',
        count: 1,
        firstOccurredAt: '2026-07-23T10:00:00.000Z',
        lastOccurredAt: '2026-07-23T10:00:00.000Z',
      },
    ],
  })
  const serialized = JSON.stringify(document)
  assert.doesNotMatch(serialized, /secret-id|RAW_/)
})

test('inspection form validation links missing dates, date order, and source selection', () => {
  assert.deepEqual(
    validateInspectionRecordForm({
      periodStart: '',
      periodEnd: '',
      selectedSourceCount: 0,
    }),
    {
      periodStart: 'Enter the start of the period.',
      periodEnd: 'Enter the end of the period.',
      sources: 'Choose at least one record to include.',
    },
  )
  assert.deepEqual(
    validateInspectionRecordForm({
      periodStart: '2026-07-24',
      periodEnd: '2026-07-20',
      selectedSourceCount: 1,
    }),
    {
      periodEnd: 'The end of the period must be on or after the start.',
    },
  )
})

test('changed source results discard a selection that is no longer available', () => {
  const selected = [
    {
      id: 'visit-1',
      sourceType: 'VISIT' as const,
      occurredAt: '2026-07-22T10:00:00.000Z',
    },
  ]

  assert.deepEqual(
    reconcileInspectionSourceSelections(selected, [
      {
        id: 'visit-2',
        sourceType: 'VISIT',
        occurredAt: '2026-07-23T10:00:00.000Z',
      },
    ]),
    [],
  )

  const refreshedCandidate = {
    id: 'visit-1',
    sourceType: 'VISIT' as const,
    occurredAt: '2026-07-24T10:00:00.000Z',
    status: 'COMPLETED',
  }
  assert.deepEqual(
    reconcileInspectionSourceSelections(selected, [refreshedCandidate]),
    [refreshedCandidate],
  )
})

test('client-list failure suppresses the conflicting requested-client unavailable state', () => {
  assert.equal(
    shouldShowRequestedClientUnavailable({
      clientListUnavailable: true,
      requestedClientInvalid: false,
      requestedClientId: 'client-1',
      selectedClientAvailable: false,
    }),
    false,
  )
  assert.equal(
    shouldShowRequestedClientUnavailable({
      clientListUnavailable: false,
      requestedClientInvalid: false,
      requestedClientId: 'client-1',
      selectedClientAvailable: false,
    }),
    true,
  )
  assert.equal(
    shouldShowRequestedClientUnavailable({
      clientListUnavailable: false,
      requestedClientInvalid: true,
      selectedClientAvailable: false,
    }),
    true,
  )
})
